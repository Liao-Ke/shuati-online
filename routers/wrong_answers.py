import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from models import AnswerRecord, ExamRecord, Question, User
from schemas import WrongAnswerStartRequest
from utils import parse_answer, parse_json_field

router = APIRouter(prefix="/api/wrong-answers", tags=["错题"])


def _get_wrong_question_ids(user: User, db: Session) -> list[int]:
    """返回用户当前真正答错的题目 ID 列表（基于每题最近一次作答）。"""
    # 子查询：每道题的最新作答时间
    subq = (
        db.query(
            AnswerRecord.question_id,
            func.max(AnswerRecord.answered_at).label("max_at"),
        )
        .join(ExamRecord)
        .filter(ExamRecord.user_id == user.id)
        .group_by(AnswerRecord.question_id)
        .subquery()
    )
    # 连接子查询，取最新作答记录，只保留答错的
    latest_wrong = (
        db.query(AnswerRecord)
        .join(
            subq,
            (AnswerRecord.question_id == subq.c.question_id)
            & (AnswerRecord.answered_at == subq.c.max_at),
        )
        .filter(AnswerRecord.is_correct == False)
        .order_by(desc(AnswerRecord.answered_at))
        .all()
    )
    seen = set()
    ids = []
    for r in latest_wrong:
        if r.question_id not in seen:
            seen.add(r.question_id)
            ids.append(r.question_id)
    return ids


@router.get("")
def list_wrong(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wrong_ids = _get_wrong_question_ids(user, db)

    if not wrong_ids:
        return []

    # 按 answered_at 降序排列
    id_order = {qid: i for i, qid in enumerate(wrong_ids)}
    questions = (
        db.query(Question)
        .options(joinedload(Question.question_bank))
        .filter(Question.id.in_(wrong_ids))
        .all()
    )
    questions.sort(key=lambda q: id_order.get(q.id, 9999))

    # 批量查所有错题的最近错误作答记录，避免 N+1 查询
    wrong_id_list = [q.id for q in questions]
    latest_subq = (
        db.query(
            AnswerRecord.question_id,
            func.max(AnswerRecord.answered_at).label("max_at"),
        )
        .join(ExamRecord)
        .filter(
            ExamRecord.user_id == user.id,
            AnswerRecord.question_id.in_(wrong_id_list),
            AnswerRecord.is_correct == False,
        )
        .group_by(AnswerRecord.question_id)
        .subquery()
    )
    latest_records = (
        db.query(AnswerRecord)
        .join(
            latest_subq,
            (AnswerRecord.question_id == latest_subq.c.question_id)
            & (AnswerRecord.answered_at == latest_subq.c.max_at),
        )
        .all()
    )
    record_map = {r.question_id: r for r in latest_records}

    result = []
    for q in questions:
        latest_record = record_map.get(q.id)
        user_answer = parse_json_field(latest_record.user_answer) if latest_record else None
        result.append({
            "question_id": q.id,
            "bank_id": q.bank_id,
            "bank_title": q.question_bank.title if q.question_bank else "",
            "type": q.type,
            "chapter": q.chapter,
            "content": q.content,
            "options": parse_json_field(q.options),
            "correct_answer": parse_answer(q.answer, q.type),
            "user_answer": user_answer,
            "analysis": q.analysis,
        })
    return result


@router.post("/start")
def start_wrong_answer_practice(
    data: WrongAnswerStartRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """从错题本中筛选错题，创建一场错题练习。"""
    wrong_ids = _get_wrong_question_ids(user, db)

    if not wrong_ids:
        raise HTTPException(status_code=400, detail="没有错题可以练习")

    questions = (
        db.query(Question)
        .filter(Question.id.in_(wrong_ids))
        .all()
    )

    if data.bank_ids:
        allowed_bank_ids = set(data.bank_ids)
        questions = [q for q in questions if q.bank_id in allowed_bank_ids]

    if not questions:
        raise HTTPException(status_code=400, detail="所选题库中没有错题")

    involved_bank_ids = list(set(q.bank_id for q in questions))
    question_ids = [q.id for q in questions]

    exam = ExamRecord(
        user_id=user.id,
        bank_ids=json.dumps(involved_bank_ids),
        mode="sequential",
        question_count=len(questions),
        question_ids=json.dumps(question_ids),
        timer_mode=data.timer_mode,
        status="in_progress",
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    return {"exam_id": exam.id, "total_count": len(questions)}
