from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ExamRecord, User
from routers.exam import exam_result as _exam_result
from schemas import ExamResult, HistoryItem

router = APIRouter(prefix="/api/history", tags=["练习历史"])


@router.get("", response_model=list[HistoryItem])
def list_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = (
        db.query(ExamRecord)
        .filter(ExamRecord.user_id == user.id, ExamRecord.status == "completed")
        .order_by(desc(ExamRecord.started_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    result = []
    for r in records:
        total = r.correct_count + r.wrong_count
        accuracy = round(r.correct_count / total, 4) if total > 0 else 0
        result.append(HistoryItem(
            id=r.id,
            bank_ids=r.bank_ids,
            mode=r.mode,
            question_count=r.question_count,
            correct_count=r.correct_count,
            wrong_count=r.wrong_count,
            accuracy=accuracy,
            duration_seconds=r.duration_seconds or 0,
            started_at=r.started_at.isoformat(),
        ))
    return result


@router.get("/{exam_id}", response_model=ExamResult)
def history_detail(exam_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _exam_result(exam_id, user, db)
