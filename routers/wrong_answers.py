from fastapi import APIRouter, Depends
from utils import parse_json_field
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, AnswerRecord, ExamRecord
from auth import get_current_user

router = APIRouter(prefix="/api/wrong-answers", tags=["错题"])


@router.get("")
def list_wrong(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = (
        db.query(AnswerRecord)
        .join(ExamRecord)
        .filter(
            ExamRecord.user_id == user.id,
            AnswerRecord.is_correct == False,
        )
        .order_by(desc(AnswerRecord.answered_at))
        .all()
    )

    seen_q = set()
    result = []
    for r in records:
        if r.question_id in seen_q:
            continue
        seen_q.add(r.question_id)
        q = r.question
        if not q:
            continue
        correct_answer = parse_json_field(q.answer)
        user_answer = parse_json_field(r.user_answer)
        result.append({
            "question_id": q.id,
            "bank_title": q.question_bank.title if q.question_bank else "",
            "type": q.type,
            "chapter": q.chapter,
            "content": q.content,
            "options": parse_json_field(q.options),
            "correct_answer": correct_answer,
            "user_answer": user_answer,
            "analysis": q.analysis,
        })
    return result
