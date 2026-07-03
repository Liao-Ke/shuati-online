from fastapi import APIRouter, Depends
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ExamRecord, Question, QuestionBank, User
from schemas import DashboardData, HistoryItem

router = APIRouter(prefix="/api/dashboard", tags=["仪表盘"])


@router.get("", response_model=DashboardData)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bank_count = db.query(func.count(QuestionBank.id)).filter(
        QuestionBank.user_id == user.id
    ).scalar() or 0

    question_count = (
        db.query(func.count(Question.id))
        .join(QuestionBank)
        .filter(QuestionBank.user_id == user.id)
        .scalar() or 0
    )

    stats = db.query(
        func.count(ExamRecord.id).label("total_exams"),
        func.coalesce(func.sum(ExamRecord.correct_count), 0).label("total_correct"),
        func.coalesce(func.sum(ExamRecord.correct_count + ExamRecord.wrong_count), 0).label("total_done"),
    ).filter(
        ExamRecord.user_id == user.id, ExamRecord.status == "completed"
    ).first()

    total_exams = stats.total_exams or 0
    total_correct = int(stats.total_correct or 0)
    total_done = int(stats.total_done or 0)
    average_accuracy = round(total_correct / total_done, 4) if total_done > 0 else 0

    recent_rows = (
        db.query(ExamRecord)
        .filter(ExamRecord.user_id == user.id, ExamRecord.status == "completed")
        .order_by(desc(ExamRecord.started_at))
        .limit(5)
        .all()
    )

    recent = []
    for r in recent_rows:
        total = r.correct_count + r.wrong_count
        accuracy = round(r.correct_count / total, 4) if total > 0 else 0
        recent.append(HistoryItem(
            id=r.id, bank_ids=r.bank_ids, mode=r.mode,
            question_count=r.question_count,
            correct_count=r.correct_count, wrong_count=r.wrong_count,
            accuracy=accuracy, duration_seconds=r.duration_seconds or 0,
            started_at=r.started_at.isoformat(),
        ))

    return DashboardData(
        total_banks=bank_count,
        total_questions=question_count,
        total_exams=total_exams,
        average_accuracy=average_accuracy,
        recent_exams=recent,
    )
