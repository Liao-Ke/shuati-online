import json
from fastapi import APIRouter, Depends
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
        correct_answer = json.loads(q.answer) if q.answer and q.answer.startswith("[") else q.answer
        user_answer_raw = r.user_answer
        try:
            user_answer = json.loads(user_answer_raw) if (user_answer_raw or "").startswith("[") else user_answer_raw
        except (json.JSONDecodeError, TypeError):
            user_answer = user_answer_raw
        result.append({
            "question_id": q.id,
            "bank_title": q.question_bank.title if q.question_bank else "",
            "type": q.type,
            "chapter": q.chapter,
            "content": q.content,
            "options": json.loads(q.options) if q.options else None,
            "correct_answer": correct_answer,
            "user_answer": user_answer,
            "analysis": q.analysis,
        })
    return result
