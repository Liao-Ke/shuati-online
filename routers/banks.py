import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, QuestionBank, Question
from schemas import BankImport, BankOut, BankDetail, QuestionOut
from auth import get_current_user

router = APIRouter(prefix="/api/question-banks", tags=["题库"])


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


@router.post("/import", response_model=BankOut, status_code=201)
def import_bank(data: BankImport, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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


@router.delete("/{bank_id}", status_code=204)
def delete_bank(bank_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.user_id == user.id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    db.delete(bank)
    db.commit()
