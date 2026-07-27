from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    # 各表主键不再单独建索引：SQLite 的 INTEGER PRIMARY KEY 即 rowid 别名，
    # 二级索引永远不会被查询计划选中，纯属写放大；索引建在参与 join/filter
    # 的外键列上（issue #137，迁移 a1f7c2d3e4b5）
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    question_banks = relationship("QuestionBank", back_populates="user", cascade="all, delete-orphan")
    exam_records = relationship("ExamRecord", back_populates="user", cascade="all, delete-orphan")


class QuestionBank(Base):
    __tablename__ = "question_banks"
    # SQLite 无 AUTOINCREMENT 时新行取 max(rowid)+1，删除最高位行后 id 被复用，
    # 考试快照/答题记录里的旧 id 会重新指向他人新行——#84/#123/#125 的共同根因（issue #131）
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="question_banks")
    questions = relationship("Question", back_populates="question_bank", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"
    # 同 QuestionBank：主键单调不复用（issue #131）
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id"), nullable=False, index=True)
    type = Column(String(10), nullable=False)
    chapter = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    options = Column(Text, nullable=True)
    answer = Column(Text, nullable=False)
    analysis = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)

    question_bank = relationship("QuestionBank", back_populates="questions")
    # 答题记录属于历史答卷，题目删除后置空 question_id 保留留痕
    answer_records = relationship("AnswerRecord", back_populates="question")
    # 背题记录表达「当前掌握状态」，题目删除后即失去意义，必须级联删除（issue #84）。
    # 历史上还叠加了主键复用导致残留记录被新题目继承的问题，#131 加 AUTOINCREMENT 后已根除复用
    review_records = relationship(
        "ReviewRecord", back_populates="question", cascade="all, delete-orphan",
    )


class ExamRecord(Base):
    __tablename__ = "exam_records"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    bank_ids = Column(Text, nullable=False)
    mode = Column(String(10), nullable=False)
    question_count = Column(Integer, default=0)
    question_ids = Column(Text, nullable=True)
    correct_count = Column(Integer, default=0)
    wrong_count = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    status = Column(String(15), default="in_progress")
    timer_mode = Column(String(15), default="per_question")
    started_at = Column(DateTime, default=utcnow)
    finished_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="exam_records")
    answer_records = relationship("AnswerRecord", back_populates="exam", cascade="all, delete-orphan")


class AnswerRecord(Base):
    __tablename__ = "answer_records"

    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey("exam_records.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=True, index=True)
    # 作答时的题目快照 JSON（type/chapter/content/options/correct_answer/analysis），
    # 题目或题库删除后历史详情回退此快照展示（issue #81）
    question_snapshot = Column(Text, nullable=True)
    user_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, default=0)
    answered_at = Column(DateTime, default=utcnow)

    exam = relationship("ExamRecord", back_populates="answer_records")
    question = relationship("Question", back_populates="answer_records")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    status = Column(String(20), default="reviewing")
    reviewed_at = Column(DateTime, default=utcnow)
    review_count = Column(Integer, default=1)

    user = relationship("User")
    question = relationship("Question", back_populates="review_records")

    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_user_question_review"),
    )
