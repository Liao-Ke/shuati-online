import json
import logging
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database import get_db
from models import User, QuestionBank, Question
from schemas import BankImport, BankOut, BankDetail, QuestionOut, ImportResult, BatchImportResponse, BankUpdate
from auth import get_current_user

logger = logging.getLogger("shuati")

router = APIRouter(prefix="/api/question-banks", tags=["题库"])

VALID_TYPES = {"choice", "fill", "judge", "multiple"}
VALID_JUDGE_ANSWERS = {"对", "错"}


def validate_bank_import(data: BankImport) -> list[str]:
    errors = []
    if not data.title or not data.title.strip():
        errors.append("题库标题不能为空")
    if not data.questions or len(data.questions) == 0:
        errors.append("题库必须包含至少一道题目")
    for i, q in enumerate(data.questions):
        prefix = f"第{i + 1}题"
        if q.type not in VALID_TYPES:
            errors.append(f"{prefix}: 题型必须为 choice/fill/judge/multiple，得到 '{q.type}'")
            continue
        if not q.content or not q.content.strip():
            errors.append(f"{prefix}: 题目内容不能为空")
        if q.type == "choice":
            if not q.options or len(q.options) < 2:
                errors.append(f"{prefix}(选择题): 至少需要 2 个选项")
            if not q.answer or not isinstance(q.answer, str):
                errors.append(f"{prefix}(选择题): 答案必须为字符串（如 'A'）")
        elif q.type == "fill":
            if isinstance(q.answer, list):
                if any(not a or not a.strip() for a in q.answer):
                    errors.append(f"{prefix}(填空题): 答案数组不能包含空值")
            elif not q.answer or not isinstance(q.answer, str) or not q.answer.strip():
                errors.append(f"{prefix}(填空题): 答案不能为空")
        elif q.type == "judge":
            if q.answer not in VALID_JUDGE_ANSWERS:
                errors.append(f"{prefix}(判断题): 答案必须为'对'或'错'，得到 '{q.answer}'")
        elif q.type == "multiple":
            if not q.options or len(q.options) < 2:
                errors.append(f"{prefix}(多选题): 至少需要 2 个选项")
            if not isinstance(q.answer, list) or len(q.answer) < 1:
                errors.append(f"{prefix}(多选题): 答案必须为非空数组（如 ['A', 'C']）")
    return errors


@router.get("", response_model=list[BankOut])
def list_banks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    banks = db.query(QuestionBank).filter(QuestionBank.user_id == user.id).order_by(QuestionBank.updated_at.desc()).all()
    result = []
    for bank in banks:
        result.append(BankOut(
            id=bank.id,
            title=bank.title,
            description=bank.description,
            question_count=len(bank.questions),
            created_at=bank.created_at.isoformat(),
            updated_at=bank.updated_at.isoformat(),
        ))
    return result


@router.get("/{bank_id}", response_model=BankDetail)
def get_bank(bank_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.user_id == user.id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    questions_out = []
    for q in bank.questions:
        questions_out.append(QuestionOut(
            id=q.id, type=q.type, chapter=q.chapter, content=q.content,
            options=q.options, answer=q.answer, analysis=q.analysis,
            sort_order=q.sort_order,
        ))
    return BankDetail(
        id=bank.id, title=bank.title, description=bank.description,
        question_count=len(bank.questions), questions=questions_out,
        created_at=bank.created_at.isoformat(),
        updated_at=bank.updated_at.isoformat(),
    )


def _do_import_one(data: BankImport, user: User, db: Session) -> BankOut:
    bank = QuestionBank(user_id=user.id, title=data.title, description=data.description)
    db.add(bank)
    db.flush()
    for i, q in enumerate(data.questions):
        options_str = json.dumps(q.options, ensure_ascii=False) if q.options else None
        answer_str = json.dumps(q.answer, ensure_ascii=False) if isinstance(q.answer, list) else q.answer
        question = Question(
            bank_id=bank.id, type=q.type, chapter=q.chapter or None,
            content=q.content, options=options_str, answer=answer_str,
            analysis=q.analysis or None, sort_order=i,
        )
        db.add(question)
    db.commit()
    db.refresh(bank)
    return BankOut(
        id=bank.id, title=bank.title, description=bank.description,
        question_count=len(data.questions),
        created_at=bank.created_at.isoformat(),
        updated_at=bank.updated_at.isoformat(),
    )


@router.post("/import", response_model=BankOut, status_code=201)
def import_bank(data: BankImport, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    errors = validate_bank_import(data)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    result = _do_import_one(data, user, db)
    logger.info(f"用户 {user.id} 导入题库：{result.title}，{result.question_count} 题")
    return result


@router.post("/import-multiple", response_model=BatchImportResponse)
def import_banks_multiple(
    data: list[BankImport],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = []
    for item in data:
        errors = validate_bank_import(item)
        if errors:
            results.append(ImportResult(
                success=False, title=item.title or "(未命名)",
                error="; ".join(errors),
            ))
            continue
        try:
            out = _do_import_one(item, user, db)
            results.append(ImportResult(
                success=True, title=out.title,
                question_count=out.question_count,
            ))
        except Exception as e:
            db.rollback()
            results.append(ImportResult(
                success=False, title=item.title,
                error=str(e),
            ))
    return BatchImportResponse(results=results)


@router.delete("/{bank_id}", status_code=204)
def delete_bank(bank_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.user_id == user.id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    logger.info(f"用户 {user.id} 删除题库：{bank.title}")
    db.delete(bank)
    db.commit()


@router.put("/{bank_id}", response_model=BankOut)
def update_bank(
    bank_id: int, data: BankUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.user_id == user.id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    if data.title is not None:
        if not data.title.strip():
            raise HTTPException(status_code=400, detail="标题不能为空")
        bank.title = data.title
    if data.description is not None:
        bank.description = data.description
    db.commit()
    db.refresh(bank)
    return BankOut(
        id=bank.id, title=bank.title, description=bank.description,
        question_count=len(bank.questions),
        created_at=bank.created_at.isoformat(),
        updated_at=bank.updated_at.isoformat(),
    )


@router.get("/{bank_id}/export")
def export_bank(
    bank_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.user_id == user.id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    questions = []
    for q in bank.questions:
        qdata = {
            "type": q.type,
        }
        if q.chapter:
            qdata["chapter"] = q.chapter
        qdata["content"] = q.content
        if q.options:
            qdata["options"] = json.loads(q.options)
        qdata["answer"] = json.loads(q.answer) if (q.answer and q.answer.startswith("[")) else q.answer
        if q.analysis:
            qdata["analysis"] = q.analysis
        questions.append(qdata)

    export = {
        "title": bank.title,
        "description": bank.description,
        "questions": questions,
    }

    json_str = json.dumps(export, ensure_ascii=False, indent=2)
    filename = f"{bank.title}.json"
    safe_filename = quote(filename, safe='')
    return Response(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}"},
    )
