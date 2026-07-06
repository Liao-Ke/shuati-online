import json
import logging
import random
import zlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import AnswerRecord, ExamRecord, Question, QuestionBank, User, utcnow
from schemas import AnswerResult, AnswerSubmit, ExamCurrent, ExamProgress, ExamResult, ExamStart, QuestionOut
from utils import parse_answer, parse_json_field

logger = logging.getLogger("shuati")

router = APIRouter(prefix="/api/exam", tags=["答题"])


def _serialize_question(q: Question, hide_answer: bool = True) -> QuestionOut:
    return QuestionOut(
        id=q.id, type=q.type, chapter=q.chapter, content=q.content,
        options=q.options,
        answer=None if hide_answer else q.answer,
        analysis=None if hide_answer else q.analysis,
        sort_order=q.sort_order,
    )


def _load_all_exam_questions(exam: ExamRecord, db: Session) -> tuple[list[Question], dict[int, AnswerRecord]]:
    bank_ids = parse_json_field(exam.bank_ids)
    banks = db.query(QuestionBank).filter(QuestionBank.id.in_(bank_ids)).all()
    all_questions = []
    for bank in banks:
        all_questions.extend(bank.questions)

    if exam.question_ids:
        selected_ids = set(parse_json_field(exam.question_ids))
        all_questions = [q for q in all_questions if q.id in selected_ids]

    if exam.mode == "random":
        random.Random(exam.id).shuffle(all_questions)
    else:
        all_questions.sort(key=lambda q: (q.bank_id or 0, q.sort_order or 0, q.id or 0))

    answered = db.query(AnswerRecord).filter(AnswerRecord.exam_id == exam.id).all()
    answered_map = {a.question_id: a for a in answered}
    return all_questions, answered_map


def _load_exam_questions(exam: ExamRecord, db: Session) -> tuple[list[Question], list[AnswerRecord]]:
    all_questions, answered_map = _load_all_exam_questions(exam, db)
    answered = list(answered_map.values())
    remaining = [q for q in all_questions if q.id not in answered_map]
    return remaining, answered


@router.post("/start")
def start_exam(data: ExamStart, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    banks = db.query(QuestionBank).filter(
        QuestionBank.id.in_(data.bank_ids),
        QuestionBank.user_id == user.id,
    ).all()
    if not banks:
        raise HTTPException(status_code=400, detail="题库不存在")
    questions = []
    for bank in banks:
        for q in bank.questions:
            if data.types is not None and q.type not in data.types:
                continue
            if data.chapters and q.chapter not in data.chapters:
                continue
            questions.append(q)
    if not questions:
        raise HTTPException(status_code=400, detail="没有符合条件的题目")

    if data.question_count and data.question_count < len(questions):
        # hash() 默认随机化会导致重启后抽题结果不一致，改用 crc32 确保确定性种子。
        seed = user.id + zlib.crc32(str(data.bank_ids).encode()) + (data.question_count or 0)
        selected = random.Random(seed).sample(questions, data.question_count)
        question_ids = [q.id for q in selected]
    else:
        selected = questions
        question_ids = [q.id for q in selected]

    exam = ExamRecord(
        user_id=user.id,
        bank_ids=json.dumps(data.bank_ids),
        mode=data.mode,
        question_count=len(selected),
        question_ids=json.dumps(question_ids),
        timer_mode=data.timer_mode,
        status="in_progress",
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    logger.info(f"用户 {user.id} 开始考试，exam_id={exam.id}，题目数={len(selected)}")
    return {"exam_id": exam.id, "total_count": len(selected), "timer_mode": data.timer_mode, "started_at": exam.started_at.isoformat()}


@router.get("/{exam_id}/current")
def current_question(
    exam_id: int,
    index: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam = db.query(ExamRecord).filter(
        ExamRecord.id == exam_id, ExamRecord.user_id == user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="练习记录不存在")

    all_questions, answered_map = _load_all_exam_questions(exam, db)

    if index is not None:
        if index < 0 or index >= len(all_questions):
            raise HTTPException(status_code=400, detail="索引超出范围")
        q = all_questions[index]
        record = answered_map.get(q.id)
        is_answered = record is not None
        q_out = _serialize_question(q, hide_answer=not is_answered)
        user_answer_display = None
        if record and record.user_answer:
            user_answer_display = parse_json_field(record.user_answer)
        correct_answer = None
        if is_answered:
            correct_answer = parse_answer(q.answer, q.type)
        return ExamCurrent(
            exam_id=exam.id, current_index=index + 1, total_count=exam.question_count,
            question=q_out, is_answered=is_answered,
            user_answer=str(user_answer_display) if user_answer_display else None,
            is_correct=record.is_correct if record else None,
            correct_answer=str(correct_answer) if correct_answer else None,
        )

    remaining = [q for q in all_questions if q.id not in answered_map]

    if not remaining:
        return ExamCurrent(exam_id=exam.id, current_index=len(answered_map), total_count=exam.question_count, question=None)

    answered = list(answered_map.values())
    q = remaining[0]
    q_out = _serialize_question(q, hide_answer=True)
    return ExamCurrent(
        exam_id=exam.id, current_index=len(answered) + 1,
        total_count=exam.question_count, question=q_out,
    )


@router.get("/{exam_id}/progress", response_model=ExamProgress)
def exam_progress(
    exam_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam = db.query(ExamRecord).filter(
        ExamRecord.id == exam_id, ExamRecord.user_id == user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="练习记录不存在")

    all_questions, answered_map = _load_all_exam_questions(exam, db)
    answers = []
    for i, q in enumerate(all_questions):
        record = answered_map.get(q.id)
        if record:
            answers.append({"index": i, "is_correct": record.is_correct})

    return ExamProgress(
        total_count=len(all_questions),
        current_index=0,
        answers=answers,
    )


@router.post("/{exam_id}/answer", response_model=AnswerResult)
def submit_answer(
    exam_id: int,
    data: AnswerSubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 信任边界校验：路径 exam_id 必须与请求体 exam_id 一致，否则拒绝（issue #46）
    if exam_id != data.exam_id:
        raise HTTPException(status_code=400, detail="路径 exam_id 与请求体 exam_id 不一致")
    exam = db.query(ExamRecord).filter(
        ExamRecord.id == data.exam_id, ExamRecord.user_id == user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="练习不存在")

    if exam.status == "completed":
        raise HTTPException(status_code=400, detail="考试已结束，无法提交答案")

    if exam.question_ids:
        valid_ids = set(parse_json_field(exam.question_ids))
        if data.question_id not in valid_ids:
            raise HTTPException(status_code=400, detail="该题目不属于本次考试")

    existing = db.query(AnswerRecord).filter(
        AnswerRecord.exam_id == exam.id, AnswerRecord.question_id == data.question_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该题目已作答，不可重复提交")

    question = db.query(Question).filter(Question.id == data.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    correct_answer = parse_answer(question.answer, question.type)

    options = parse_json_field(question.options) if question.options else None
    valid_labels = (
        [chr(65 + i) for i in range(len(options))]
        if isinstance(options, list) and question.type in ("choice", "multiple")
        else None
    )
    if question.type == "choice" and data.user_answer is not None:
        if not valid_labels:
            raise HTTPException(status_code=400, detail="题目选项数据异常")
        if not isinstance(data.user_answer, str):
            raise HTTPException(status_code=400, detail="选择题答案必须为字符串")
        if data.user_answer not in valid_labels:
            raise HTTPException(status_code=400, detail=f"无效选项：{data.user_answer}")
    elif question.type == "judge" and data.user_answer is not None:
        if data.user_answer not in ("对", "错"):
            raise HTTPException(status_code=400, detail=f"判断题答案必须为'对'或'错'，得到 '{data.user_answer}'")
    elif question.type == "multiple" and data.user_answer is not None:
        if not valid_labels:
            raise HTTPException(status_code=400, detail="题目选项数据异常")
        if not isinstance(data.user_answer, list):
            raise HTTPException(status_code=400, detail="多选题答案必须为列表")
        if len(data.user_answer) == 0:
            raise HTTPException(status_code=400, detail="多选题答案不能为空")
        if len(set(data.user_answer)) != len(data.user_answer):
            raise HTTPException(status_code=400, detail="多选题答案不能包含重复选项")
        invalid = [a for a in data.user_answer if a not in valid_labels]
        if invalid:
            raise HTTPException(status_code=400, detail=f"无效选项：{', '.join(invalid)}")

    if question.type == "choice" or question.type == "judge":
        is_correct = data.user_answer == correct_answer
    elif question.type == "fill":
        if isinstance(correct_answer, list):
            user_list = data.user_answer if isinstance(data.user_answer, list) else [data.user_answer]
            is_correct = len(user_list) == len(correct_answer) and all(
                (u or "").strip() == (c or "").strip() for u, c in zip(user_list, correct_answer, strict=True)
            )
        else:
            is_correct = (data.user_answer or "").strip() == (correct_answer or "").strip()
    elif question.type == "multiple":
        if isinstance(correct_answer, list) and isinstance(data.user_answer, list):
            is_correct = sorted(correct_answer) == sorted(data.user_answer)
        else:
            is_correct = False
    else:
        is_correct = False

    user_answer_str = json.dumps(data.user_answer, ensure_ascii=False) if isinstance(data.user_answer, list) else (data.user_answer or "")
    record = AnswerRecord(
        exam_id=exam.id, question_id=question.id,
        user_answer=user_answer_str, is_correct=is_correct,
        time_spent_seconds=data.time_spent_seconds,
    )
    db.add(record)
    # 原子化计数更新，避免并发 read-modify-write 竞态导致计数丢失（issue #26）
    db.query(ExamRecord).filter(ExamRecord.id == exam.id).update(
        {
            ExamRecord.correct_count: ExamRecord.correct_count + (1 if is_correct else 0),
            ExamRecord.wrong_count: ExamRecord.wrong_count + (0 if is_correct else 1),
            ExamRecord.duration_seconds: func.coalesce(ExamRecord.duration_seconds, 0) + record.time_spent_seconds,
        },
        synchronize_session=False,
    )
    db.commit()

    remaining, answered = _load_exam_questions(exam, db)
    is_last = len(remaining) == 0

    if is_last:
        exam.status = "completed"
        exam.finished_at = utcnow()
        if exam.timer_mode == "elapsed" and exam.started_at and exam.finished_at:
            exam.duration_seconds = int((exam.finished_at - exam.started_at).total_seconds())
        db.commit()

    correct_display = correct_answer
    if isinstance(correct_answer, list):
        correct_display = correct_answer

    return AnswerResult(
        is_correct=is_correct,
        correct_answer=correct_display,
        analysis=question.analysis,
        next_index=None if is_last else len(answered),
        is_last=is_last,
    )


@router.get("/{exam_id}/preview")
def exam_preview(
    exam_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam = db.query(ExamRecord).filter(
        ExamRecord.id == exam_id, ExamRecord.user_id == user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="练习不存在")

    all_questions, answered_map = _load_all_exam_questions(exam, db)
    questions = []
    for i, q in enumerate(all_questions):
        record = answered_map.get(q.id)
        is_answered = record is not None
        correct_answer = parse_answer(q.answer, q.type) if is_answered else None
        analysis = q.analysis if is_answered else None
        user_answer = None
        if record and record.user_answer:
            user_answer = parse_json_field(record.user_answer)
        questions.append({
            "index": i,
            "id": q.id,
            "type": q.type,
            "chapter": q.chapter,
            "content": q.content,
            "options": parse_json_field(q.options),
            "answer": correct_answer,
            "analysis": analysis,
            "user_answer": user_answer,
            "is_answered": is_answered,
            "is_correct": record.is_correct if record else None,
        })
    return {"total_count": len(questions), "questions": questions}


@router.post("/{exam_id}/finish")
def finish_exam(
    exam_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam = db.query(ExamRecord).filter(
        ExamRecord.id == exam_id, ExamRecord.user_id == user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="练习不存在")
    if exam.status == "completed":
        return {"exam_id": exam.id, "status": "completed"}
    # 未作答题计入 wrong_count，保证 total_count == question_count（issue #22）
    answered_count = db.query(AnswerRecord).filter(AnswerRecord.exam_id == exam.id).count()
    unanswered = (exam.question_count or 0) - answered_count
    if unanswered > 0:
        exam.wrong_count = (exam.wrong_count or 0) + unanswered
    exam.status = "completed"
    exam.finished_at = utcnow()
    if exam.timer_mode == "elapsed" and exam.started_at and exam.finished_at:
        exam.duration_seconds = int((exam.finished_at - exam.started_at).total_seconds())
    db.commit()
    logger.info(f"用户 {user.id} 完成考试，exam_id={exam.id}")
    return {"exam_id": exam.id, "status": "completed"}


@router.get("/{exam_id}/result", response_model=ExamResult)
def exam_result(exam_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exam = db.query(ExamRecord).filter(
        ExamRecord.id == exam_id, ExamRecord.user_id == user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="练习不存在")
    if exam.status != "completed":
        raise HTTPException(status_code=409, detail="考试尚未结束，无法查看结果")

    answers = db.query(AnswerRecord).filter(
        AnswerRecord.exam_id == exam.id
    ).order_by(AnswerRecord.id).all()

    question_ids = [a.question_id for a in answers if a.question_id is not None]
    questions_map = {}
    if question_ids:
        for q in db.query(Question).filter(Question.id.in_(question_ids)).all():
            questions_map[q.id] = q

    result_answers = []
    for a in answers:
        q = questions_map.get(a.question_id)
        if not q:
            continue
        correct_answer = parse_answer(q.answer, q.type)
        user_answer = parse_json_field(a.user_answer)
        result_answers.append({
            "question_id": q.id,
            "type": q.type,
            "content": q.content,
            "options": parse_json_field(q.options),
            "correct_answer": correct_answer,
            "user_answer": user_answer,
            "is_correct": a.is_correct,
            "time_spent": a.time_spent_seconds,
            "analysis": q.analysis,
        })

    total = exam.correct_count + exam.wrong_count
    accuracy = round(exam.correct_count / total, 4) if total > 0 else 0
    return ExamResult(
        exam_id=exam.id,
        total_count=total,
        correct_count=exam.correct_count,
        wrong_count=exam.wrong_count,
        accuracy=accuracy,
        duration_seconds=exam.duration_seconds or 0,
        answers=result_answers,
    )
