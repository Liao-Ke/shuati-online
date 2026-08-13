import json
import logging
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from auth import get_current_user
from database import get_db
from models import AnswerRecord, ExamRecord, Question, QuestionBank, User, utcnow
from schemas import (
    AnswerResult,
    AnswerSubmit,
    ExamCurrent,
    ExamFinish,
    ExamProgress,
    ExamResult,
    ExamStart,
    QuestionOut,
    UnfinishedExam,
)
from utils import parse_answer, parse_json_field, parse_json_list

logger = logging.getLogger("shuati")

router = APIRouter(prefix="/api/exam", tags=["答题"])


def _elapsed_duration(exam: ExamRecord, elapsed_seconds: int | None) -> int:
    """整卷计时总用时：优先前端计时器口径（不含暂停时长），墙钟差值封顶防伪造（issue #115）"""
    wall = int((exam.finished_at - exam.started_at).total_seconds())
    return min(elapsed_seconds, wall) if elapsed_seconds is not None else wall


def _fill_blank_count(q: Question) -> int | None:
    """填空题空位数量——不泄露答案内容的安全元数据，供前端渲染输入框（issue #82）"""
    if q.type != "fill":
        return None
    parsed = parse_answer(q.answer, q.type)
    return len(parsed) if isinstance(parsed, list) else 1


def _serialize_question(q: Question, hide_answer: bool = True) -> QuestionOut:
    return QuestionOut(
        id=q.id, type=q.type, chapter=q.chapter, content=q.content,
        options=q.options,
        answer=None if hide_answer else q.answer,
        analysis=None if hide_answer else q.analysis,
        sort_order=q.sort_order,
        blank_count=_fill_blank_count(q),
    )


def _load_all_exam_questions(exam: ExamRecord, db: Session) -> tuple[list[Question], dict[int, AnswerRecord]]:
    bank_ids = parse_json_field(exam.bank_ids)
    if exam.question_ids:
        # 按开考时的 question_ids 快照一次查回全部题目，避免逐题库懒加载的 1+N（issue #43）。
        # bank_id 过滤保持旧实现语义（题目必须仍在本场考试的题库范围内）；
        # join 复核题库归属：SQLite 主键会被复用（issue #84），快照里的题库/题目 id
        # 可能已指向他人重建的数据，不复核会跨用户泄露题目（issue #123）
        # 快照损坏（无法解析为列表）时保持旧实现的降级口径：按空集过滤返回空考试，而非 500
        selected_ids = parse_json_list(exam.question_ids)
        all_questions = db.query(Question).join(QuestionBank).filter(
            Question.id.in_(selected_ids), Question.bank_id.in_(bank_ids),
            QuestionBank.user_id == exam.user_id,
        ).all()
    else:
        # 兼容 issue #22 之前没有 question_ids 快照的历史考试，selectinload 一次批量加载；
        # 同样复核题库归属（issue #123）
        banks = db.query(QuestionBank).options(selectinload(QuestionBank.questions)).filter(
            QuestionBank.id.in_(bank_ids),
            QuestionBank.user_id == exam.user_id,
        ).all()
        all_questions = [q for bank in banks for q in bank.questions]

    if exam.mode == "random":
        # shuffle 结果依赖输入顺序：先按 (bank_id, id) 复现旧实现「逐题库追加」的列表顺序，
        # 保证进行中的随机模式考试题序不变
        all_questions.sort(key=lambda q: (q.bank_id or 0, q.id or 0))
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
            if data.chapters is not None and q.chapter not in data.chapters:
                continue
            questions.append(q)
    if not questions:
        raise HTTPException(status_code=400, detail="没有符合条件的题目")

    if data.question_count and data.question_count < len(questions):
        # 每次开考真随机抽题（issue #144）：恢复考试依赖 question_ids 快照，
        # 不需要种子可复算，固定种子只会让同一用户永远抽到同一批题
        selected = random.sample(questions, data.question_count)
        question_ids = [q.id for q in selected]
    else:
        selected = questions
        question_ids = [q.id for q in selected]

    exam = ExamRecord(
        user_id=user.id,
        # 只存已通过归属校验的题库 id，防止把他人题库 id 写进快照（issue #125）
        bank_ids=json.dumps([b.id for b in banks]),
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


@router.get("/unfinished", response_model=list[UnfinishedExam])
def list_unfinished(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """列出当前用户所有进行中的考试，供前端展示恢复入口（issue #44）"""
    exams = db.query(ExamRecord).filter(
        ExamRecord.user_id == user.id, ExamRecord.status == "in_progress"
    ).order_by(ExamRecord.started_at.desc()).all()

    result = []
    # ponytail: 每场考试各查一次已答数和题库标题（N+1）。未完成考试通常只有个位数，
    # 若未来允许大量并存，升级为按 exam_id/bank_id 聚合的两条批量查询。
    for exam in exams:
        answered_count = db.query(func.count(AnswerRecord.id)).filter(
            AnswerRecord.exam_id == exam.id
        ).scalar() or 0
        bank_ids = parse_json_field(exam.bank_ids) or []
        # 复核题库归属：exam.bank_ids 历史上可能含未经归属校验的 id（issue #125），
        # 或题库删除后 id 被他人复用（issue #123 威胁模型），不过滤会泄露他人题库标题
        titles = [
            b.title for b in db.query(QuestionBank).filter(
                QuestionBank.id.in_(bank_ids), QuestionBank.user_id == user.id
            ).all()
        ] if bank_ids else []
        result.append(UnfinishedExam(
            exam_id=exam.id,
            bank_titles=titles,
            mode=exam.mode,
            timer_mode=exam.timer_mode,
            total_count=exam.question_count or 0,
            answered_count=answered_count,
            started_at=exam.started_at.isoformat(),
        ))
    return result


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
            user_answer=user_answer_display or None,
            is_correct=record.is_correct if record else None,
            correct_answer=correct_answer or None,
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
        # 损坏快照得空集 → 任何提交 400，与读路径的空考试降级口径一致（issue #172）
        valid_ids = set(parse_json_list(exam.question_ids))
        if data.question_id not in valid_ids:
            raise HTTPException(status_code=400, detail="该题目不属于本次考试")

    existing = db.query(AnswerRecord).filter(
        AnswerRecord.exam_id == exam.id, AnswerRecord.question_id == data.question_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该题目已作答，不可重复提交")

    # 复核题库归属：快照 id 可能因 SQLite rowid 复用（issue #84）指向他人题目，
    # 且本路径会回显 correct_answer/analysis，泄露面比读路径更大（issue #123）
    question = db.query(Question).join(QuestionBank).filter(
        Question.id == data.question_id,
        QuestionBank.user_id == exam.user_id,
    ).first()
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
    elif question.type == "fill" and data.user_answer is not None:
        # 仅校验单空题：多空题判分兼容字符串提交（前端对多空题只渲染单输入框，见 issue #82），不可拦截
        if not isinstance(correct_answer, list) and not isinstance(data.user_answer, str):
            raise HTTPException(status_code=400, detail="单空填空题答案必须为字符串")

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
    # 题目快照：题目/题库删除后历史详情回退此快照展示（issue #81）
    snapshot_str = json.dumps({
        "type": question.type, "chapter": question.chapter, "content": question.content,
        "options": options, "correct_answer": correct_answer, "analysis": question.analysis,
    }, ensure_ascii=False)
    record = AnswerRecord(
        exam_id=exam.id, question_id=question.id,
        question_snapshot=snapshot_str,
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
            exam.duration_seconds = _elapsed_duration(exam, data.elapsed_seconds)
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
            "blank_count": _fill_blank_count(q),
        })
    return {"total_count": len(questions), "questions": questions}


@router.post("/{exam_id}/finish")
def finish_exam(
    exam_id: int,
    data: ExamFinish | None = None,
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
        exam.duration_seconds = _elapsed_duration(exam, data.elapsed_seconds if data else None)
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
        # 归属复核：即便有答题记录残留指向被复用 id 的他人题目，也不回显（issue #123 纵深防御）
        rows = db.query(Question).join(QuestionBank).filter(
            Question.id.in_(question_ids),
            QuestionBank.user_id == exam.user_id,
        ).all()
        for q in rows:
            questions_map[q.id] = q

    result_answers = []
    for a in answers:
        q = questions_map.get(a.question_id)
        user_answer = parse_json_field(a.user_answer)
        if q:
            result_answers.append({
                "question_id": q.id,
                "type": q.type,
                "content": q.content,
                "options": parse_json_field(q.options),
                "correct_answer": parse_answer(q.answer, q.type),
                "user_answer": user_answer,
                "is_correct": a.is_correct,
                "time_spent": a.time_spent_seconds,
                "analysis": q.analysis,
            })
            continue
        # 题目已删除：回退作答时的快照；无快照的历史孤儿记录给占位，避免汇总数与明细数不一致（issue #81）
        try:
            snap = json.loads(a.question_snapshot) if a.question_snapshot else {}
        except (json.JSONDecodeError, TypeError):
            snap = {}
        result_answers.append({
            "question_id": a.question_id,
            "type": snap.get("type"),
            "content": snap.get("content") or "（题目已删除，仅保留作答记录）",
            "options": snap.get("options"),
            "correct_answer": snap.get("correct_answer"),
            "user_answer": user_answer,
            "is_correct": a.is_correct,
            "time_spent": a.time_spent_seconds,
            "analysis": snap.get("analysis"),
            "question_deleted": True,
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
