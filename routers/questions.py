import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ExamRecord, Question, QuestionBank, User, utcnow
from schemas import QuestionCreate, QuestionOut, QuestionUpdate
from utils import parse_answer, parse_json_list

router = APIRouter(prefix="/api", tags=["题目"])

VALID_TYPES = {"choice", "fill", "judge", "multiple"}
VALID_JUDGE_ANSWERS = {"对", "错"}


def _validate_question(type_, content, options, answer):
    errors = []
    if type_ not in VALID_TYPES:
        errors.append(f"题型必须为 choice/fill/judge/multiple，得到 '{type_}'")
        return errors
    if not content or not content.strip():
        errors.append("题目内容不能为空")
    if type_ == "choice":
        if not options or len(options) < 2:
            errors.append("选择题至少需要 2 个选项")
        if options and len(options) > 8:
            errors.append("选择题选项不能超过 8 个（A-H）")
        if options and any(not o.strip() for o in options):
            errors.append("选择题选项不能包含空白字符串")
        if not answer or not isinstance(answer, str):
            errors.append("选择题答案必须为字符串（如 'A'）")
        elif options:
            valid_labels = [chr(65 + i) for i in range(len(options))]
            if answer not in valid_labels:
                errors.append(f"选择题答案 '{answer}' 不属于现有选项 {valid_labels}")
    elif type_ == "fill":
        if isinstance(answer, list):
            # 空数组会生成 blank_count=0、空提交判对的畸形题（issue #146）
            if not answer:
                errors.append("填空题答案数组不能为空")
            elif any(not a or not a.strip() for a in answer):
                errors.append("填空题答案数组不能包含空值")
        elif not answer or not isinstance(answer, str) or not answer.strip():
            errors.append("填空题答案不能为空")
    elif type_ == "judge":
        if answer not in VALID_JUDGE_ANSWERS:
            errors.append(f"判断题答案必须为'对'或'错'，得到 '{answer}'")
    elif type_ == "multiple":
        if not options or len(options) < 2:
            errors.append("多选题至少需要 2 个选项")
        if options and len(options) > 8:
            errors.append("多选题选项不能超过 8 个（A-H）")
        if options and any(not o.strip() for o in options):
            errors.append("多选题选项不能包含空白字符串")
        if not isinstance(answer, list) or len(answer) < 1:
            errors.append("多选题答案必须为非空数组（如 ['A', 'C']）")
        elif options:
            valid_labels = [chr(65 + i) for i in range(len(options))]
            invalid = [a for a in answer if a not in valid_labels]
            if invalid:
                errors.append(f"多选题答案 {invalid} 不属于现有选项 {valid_labels}")
            if len(set(answer)) != len(answer):
                errors.append("多选题答案不能包含重复选项")
    return errors


def _question_to_out(q: Question) -> QuestionOut:
    return QuestionOut(
        id=q.id, type=q.type, chapter=q.chapter, content=q.content,
        options=q.options, answer=q.answer, analysis=q.analysis,
        sort_order=q.sort_order,
    )


@router.post("/question-banks/{bank_id}/questions", response_model=QuestionOut, status_code=201)
def create_question(
    bank_id: int, data: QuestionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.user_id == user.id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    errors = _validate_question(data.type, data.content, data.options, data.answer)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    max_order = db.query(func.max(Question.sort_order)).filter(
        Question.bank_id == bank_id
    ).scalar() or -1

    options_str = json.dumps(data.options, ensure_ascii=False) if data.options else None
    answer_str = json.dumps(data.answer, ensure_ascii=False) if isinstance(data.answer, list) else data.answer

    question = Question(
        bank_id=bank_id, type=data.type, chapter=data.chapter or None,
        content=data.content, options=options_str, answer=answer_str,
        analysis=data.analysis or None, sort_order=max_order + 1,
    )
    db.add(question)
    bank.updated_at = utcnow()
    db.commit()
    db.refresh(question)
    return _question_to_out(question)


@router.put("/questions/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: int, data: QuestionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = db.query(Question).join(QuestionBank).filter(
        Question.id == question_id,
        QuestionBank.user_id == user.id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    # 检查是否有进行中的考试引用该题目，防止编辑后判分标准被污染（issue #90）
    in_progress = db.query(ExamRecord).filter(
        ExamRecord.user_id == user.id, ExamRecord.status == "in_progress",
    ).all()
    for exam in in_progress:
        # 损坏快照按空列表处理，勿让 int in str 抛 500（issue #172）
        if question_id in parse_json_list(exam.question_ids):
            raise HTTPException(status_code=409, detail="该题目被进行中的考试引用，请先完成或放弃考试")

    new_type = data.type if data.type is not None else question.type
    new_content = data.content if data.content is not None else question.content
    # 可选字段以 model_fields_set 区分「未传」与「显式 null」：显式 null 表示清空（issue #112）
    new_chapter = data.chapter if "chapter" in data.model_fields_set else question.chapter
    new_analysis = data.analysis if "analysis" in data.model_fields_set else question.analysis

    if new_type in ("fill", "judge"):
        new_options = None
    elif data.options is not None:
        new_options = data.options
    else:
        new_options = json.loads(question.options) if question.options else None

    new_answer = data.answer if data.answer is not None else parse_answer(question.answer, new_type)

    errors = _validate_question(new_type, new_content, new_options, new_answer)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    question.type = new_type
    question.content = new_content
    question.chapter = new_chapter
    question.analysis = new_analysis
    question.options = json.dumps(new_options, ensure_ascii=False) if new_options else None
    question.answer = json.dumps(new_answer, ensure_ascii=False) if isinstance(new_answer, list) else new_answer
    question.question_bank.updated_at = utcnow()

    db.commit()
    db.refresh(question)
    return _question_to_out(question)


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(
    question_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = db.query(Question).join(QuestionBank).filter(
        Question.id == question_id,
        QuestionBank.user_id == user.id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    # 检查是否有进行中的考试引用该题目（issue #19）
    in_progress = db.query(ExamRecord).filter(
        ExamRecord.user_id == user.id, ExamRecord.status == "in_progress",
    ).all()
    for exam in in_progress:
        # 损坏快照按空列表处理，勿让 int in str 抛 500（issue #172）
        if question_id in parse_json_list(exam.question_ids):
            raise HTTPException(status_code=409, detail="该题目被进行中的考试引用，请先完成或放弃考试")
    question.question_bank.updated_at = utcnow()
    db.delete(question)
    db.commit()
