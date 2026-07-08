from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Question, QuestionBank, ReviewRecord, User, utcnow
from schemas import MarkBody, ReviewFilter, ReviewQuestionOut, ReviewStats

router = APIRouter(prefix="/api/review", tags=["背题"])


def _get_question_out(q: Question, review_status: str | None = None) -> ReviewQuestionOut:
    return ReviewQuestionOut(
        id=q.id, type=q.type, chapter=q.chapter, content=q.content,
        options=q.options, answer=q.answer, analysis=q.analysis,
        sort_order=q.sort_order, review_status=review_status,
    )


def _count_existing_review_records(db: Session, user_id: int, status: str) -> int:
    return (
        db.query(ReviewRecord)
        .join(Question, ReviewRecord.question_id == Question.id)
        .join(QuestionBank, Question.bank_id == QuestionBank.id)
        .filter(
            ReviewRecord.user_id == user_id,
            ReviewRecord.status == status,
            QuestionBank.user_id == user_id,
        )
        .count()
    )


@router.post("/questions", response_model=list[ReviewQuestionOut])
def get_review_questions(
    data: ReviewFilter,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    banks = db.query(QuestionBank).filter(
        QuestionBank.id.in_(data.bank_ids),
        QuestionBank.user_id == user.id,
    ).all()
    if not banks:
        raise HTTPException(status_code=400, detail="题库不存在")

    bank_ids = [b.id for b in banks]
    query = db.query(Question).filter(Question.bank_id.in_(bank_ids))
    if data.types is not None:
        query = query.filter(Question.type.in_(data.types))
    if data.chapters is not None:
        query = query.filter(Question.chapter.in_(data.chapters))

    questions = query.order_by(Question.bank_id, Question.sort_order, Question.id).all()
    if not questions:
        return []

    question_ids = [q.id for q in questions]
    records = db.query(ReviewRecord).filter(
        ReviewRecord.question_id.in_(question_ids),
        ReviewRecord.user_id == user.id,
    ).all()
    record_map = {r.question_id: r.status for r in records}

    result = []
    for q in questions:
        status = record_map.get(q.id)
        if data.show_reviewing_only and status != "reviewing":
            continue
        result.append(_get_question_out(q, status))

    return result


class _ChaptersRequest(BaseModel):
    bank_ids: list[int]


@router.post("/chapters")
def get_chapters(
    data: _ChaptersRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    banks = db.query(QuestionBank).filter(
        QuestionBank.id.in_(data.bank_ids),
        QuestionBank.user_id == user.id,
    ).all()
    if not banks:
        return []
    bank_ids = [b.id for b in banks]
    rows = db.query(Question.chapter).filter(
        Question.bank_id.in_(bank_ids),
        Question.chapter.isnot(None),
        Question.chapter != "",
    ).distinct().order_by(Question.chapter).all()
    return [r[0] for r in rows]


@router.post("/mark")
def mark_question(
    data: MarkBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.status not in ("known", "reviewing"):
        raise HTTPException(status_code=400, detail="状态值无效，仅支持 known/reviewing")

    question = (
        db.query(Question)
        .join(QuestionBank)
        .filter(Question.id == data.question_id, QuestionBank.user_id == user.id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    record = db.query(ReviewRecord).filter(
        ReviewRecord.user_id == user.id,
        ReviewRecord.question_id == data.question_id,
    ).first()

    if record:
        if record.status != data.status:
            record.status = data.status
            record.review_count += 1
        record.reviewed_at = utcnow()
    else:
        record = ReviewRecord(
            user_id=user.id,
            question_id=data.question_id,
            status=data.status,
        )
        db.add(record)

    db.commit()

    known = _count_existing_review_records(db, user.id, "known")
    reviewing = _count_existing_review_records(db, user.id, "reviewing")

    return ReviewStats(known_count=known, reviewing_count=reviewing, total_reviewed=known + reviewing)


@router.get("/stats", response_model=ReviewStats)
def review_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    known = _count_existing_review_records(db, user.id, "known")
    reviewing = _count_existing_review_records(db, user.id, "reviewing")
    return ReviewStats(known_count=known, reviewing_count=reviewing, total_reviewed=known + reviewing)
