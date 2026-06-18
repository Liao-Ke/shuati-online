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

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    question_banks = relationship("QuestionBank", back_populates="user", cascade="all, delete-orphan")
    exam_records = relationship("ExamRecord", back_populates="user", cascade="all, delete-orphan")


class QuestionBank(Base):
    __tablename__ = "question_banks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="question_banks")
    questions = relationship("Question", back_populates="question_bank", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id"), nullable=False)
    type = Column(String(10), nullable=False)
    chapter = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    options = Column(Text, nullable=True)
    answer = Column(Text, nullable=False)
    analysis = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)

    question_bank = relationship("QuestionBank", back_populates="questions")
    answer_records = relationship("AnswerRecord", back_populates="question")


class ExamRecord(Base):
    __tablename__ = "exam_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exam_records.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)
    user_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, default=0)
    answered_at = Column(DateTime, default=utcnow)

    exam = relationship("ExamRecord", back_populates="answer_records")
    question = relationship("Question", back_populates="answer_records")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    status = Column(String(20), default="reviewing")
    reviewed_at = Column(DateTime, default=utcnow)
    review_count = Column(Integer, default=1)

    user = relationship("User")
    question = relationship("Question")

    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_user_question_review"),
    )
