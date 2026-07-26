
from pydantic import BaseModel, Field, field_validator


class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class QuestionImport(BaseModel):
    type: str
    chapter: str | None = None
    content: str
    options: list[str] | None = None
    answer: str | list[str]
    analysis: str | None = None


class BankImport(BaseModel):
    title: str
    description: str | None = None
    questions: list[QuestionImport]


class QuestionOut(BaseModel):
    id: int
    type: str
    chapter: str | None = None
    content: str
    options: str | None = None
    answer: str | None = None
    analysis: str | None = None
    sort_order: int

    class Config:
        from_attributes = True


class BankOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    question_count: int = 0
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class BankDetail(BankOut):
    questions: list[QuestionOut] = []


class ExamStart(BaseModel):
    bank_ids: list[int]
    mode: str
    types: list[str] | None = None
    question_count: int | None = Field(default=None, ge=1)
    timer_mode: str = "per_question"
    chapters: list[str] | None = None
    choice_timeout: int = 30
    judge_fill_timeout: int = 60

    @field_validator("mode")
    @classmethod
    def _validate_mode(cls, v: str) -> str:
        if v not in ("sequential", "random"):
            raise ValueError("mode 必须为 sequential 或 random")
        return v

    @field_validator("timer_mode")
    @classmethod
    def _validate_timer_mode(cls, v: str) -> str:
        if v not in ("per_question", "elapsed"):
            raise ValueError("timer_mode 必须为 per_question 或 elapsed")
        return v


class ExamCurrent(BaseModel):
    exam_id: int
    current_index: int
    total_count: int
    question: QuestionOut | None = None
    is_answered: bool = False
    user_answer: str | None = None
    is_correct: bool | None = None
    correct_answer: str | None = None


class AnswerSubmit(BaseModel):
    exam_id: int
    question_id: int
    user_answer: str | list[str] | None = None
    time_spent_seconds: int = Field(ge=0)
    # 整卷计时模式下前端计时器口径的已用秒数（不含暂停时长），仅最后一题自动结束时生效（issue #115）
    elapsed_seconds: int | None = Field(default=None, ge=0)


class ExamFinish(BaseModel):
    # 整卷计时模式下前端计时器口径的已用秒数（不含暂停时长），issue #115
    elapsed_seconds: int | None = Field(default=None, ge=0)


class AnswerResult(BaseModel):
    is_correct: bool
    correct_answer: str | list[str]
    analysis: str | None = None
    next_index: int | None = None
    is_last: bool = False


class ExamResult(BaseModel):
    exam_id: int
    total_count: int
    correct_count: int
    wrong_count: int
    accuracy: float
    duration_seconds: int
    answers: list[dict]


class HistoryItem(BaseModel):
    id: int
    bank_ids: str
    mode: str
    question_count: int
    correct_count: int
    wrong_count: int
    accuracy: float
    duration_seconds: int
    started_at: str

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: bool
    title: str
    question_count: int = 0
    error: str | None = None


class BatchImportResponse(BaseModel):
    results: list[ImportResult]


class DashboardData(BaseModel):
    total_banks: int = 0
    total_questions: int = 0
    total_exams: int = 0
    average_accuracy: float = 0
    recent_exams: list[HistoryItem] = []


class ReviewFilter(BaseModel):
    bank_ids: list[int]
    types: list[str] | None = None
    chapters: list[str] | None = None
    show_reviewing_only: bool = False


class ReviewQuestionOut(BaseModel):
    id: int
    type: str
    chapter: str | None = None
    content: str
    options: str | None = None
    answer: str
    analysis: str | None = None
    sort_order: int
    review_status: str | None = None

    class Config:
        from_attributes = True


class MarkBody(BaseModel):
    question_id: int
    status: str


class ReviewStats(BaseModel):
    known_count: int = 0
    reviewing_count: int = 0
    total_reviewed: int = 0


class ExamProgress(BaseModel):
    total_count: int
    current_index: int
    answers: list[dict] = []


class QuestionCreate(BaseModel):
    type: str
    chapter: str | None = None
    content: str
    options: list[str] | None = None
    answer: str | list[str]
    analysis: str | None = None


class QuestionUpdate(BaseModel):
    type: str | None = None
    chapter: str | None = None
    content: str | None = None
    options: list[str] | None = None
    answer: str | list[str] | None = None
    analysis: str | None = None


class BankUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class WrongAnswerStartRequest(BaseModel):
    bank_ids: list[int] | None = None
    timer_mode: str = "per_question"

    @field_validator("timer_mode")
    @classmethod
    def _validate_timer_mode(cls, v: str) -> str:
        if v not in ("per_question", "elapsed"):
            raise ValueError("timer_mode 必须为 per_question 或 elapsed")
        return v
