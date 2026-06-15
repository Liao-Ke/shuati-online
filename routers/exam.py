import json
import random
import logging
from fastapi import APIRouter, Depends, HTTPException
from utils import parse_json_field
from sqlalchemy.orm import Session
from database import get_db
from models import User, QuestionBank, Question, ExamRecord, AnswerRecord, utcnow
from schemas import ExamStart, ExamCurrent, QuestionOut, AnswerSubmit, AnswerResult, ExamResult, ExamProgress
from auth import get_current_user

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
        random.seed(exam.id)
        random.shuffle(all_questions)
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
            if data.types and q.type not in data.types:
                continue
            questions.append(q)
    if not questions:
        raise HTTPException(status_code=400, detail="没有符合条件的题目")

    if data.question_count and data.question_count < len(questions):
        random.seed(user.id + hash(str(data.bank_ids)) + (data.question_count or 0))
        selected = random.sample(questions, data.question_count)
        question_ids = [q.id for q in selected]
    else:
        selected = questions
        question_ids = None

    exam = ExamRecord(
        user_id=user.id,
        bank_ids=json.dumps(data.bank_ids),
        mode=data.mode,
        question_count=len(selected),
        question_ids=json.dumps(question_ids) if question_ids else None,
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
            correct_answer = parse_json_field(q.answer)
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
def submit_answer(data: AnswerSubmit, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exam = db.query(ExamRecord).filter(
        ExamRecord.id == data.exam_id, ExamRecord.user_id == user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="练习不存在")

    question = db.query(Question).filter(Question.id == data.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    correct_answer = parse_json_field(question.answer)

    if question.type == "choice":
        is_correct = data.user_answer == correct_answer
    elif question.type == "judge":
        is_correct = data.user_answer == correct_answer
    elif question.type == "fill":
        if isinstance(correct_answer, list):
            user_list = data.user_answer if isinstance(data.user_answer, list) else [data.user_answer]
            is_correct = len(user_list) == len(correct_answer) and all(
                (u or "").strip() == (c or "").strip() for u, c in zip(user_list, correct_answer)
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
    if is_correct:
        exam.correct_count += 1
    else:
        exam.wrong_count += 1
    exam.duration_seconds = (exam.duration_seconds or 0) + record.time_spent_seconds
    db.commit()

    remaining, answered = _load_exam_questions(exam, db)
    is_last = len(remaining) == 0

    if is_last:
        exam.status = "completed"
        exam.finished_at = utcnow()
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
        correct_answer = parse_json_field(q.answer)
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
            "analysis": q.analysis,
            "user_answer": user_answer,
            "is_answered": record is not None,
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
    exam.status = "completed"
    exam.finished_at = utcnow()
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
        correct_answer = parse_json_field(q.answer)
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
