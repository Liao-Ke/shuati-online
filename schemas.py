from pydantic import BaseModel
from typing import Optional, List, Union


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
    chapter: Optional[str] = None
    content: str
    options: Optional[List[str]] = None
    answer: Union[str, List[str]]
    analysis: Optional[str] = None


class BankImport(BaseModel):
    title: str
    description: Optional[str] = None
    questions: List[QuestionImport]


class QuestionOut(BaseModel):
    id: int
    type: str
    chapter: Optional[str] = None
    content: str
    options: Optional[str] = None
    answer: Optional[str] = None
    analysis: Optional[str] = None
    sort_order: int

    class Config:
        from_attributes = True


class BankOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    question_count: int = 0
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class BankDetail(BankOut):
    questions: List[QuestionOut] = []


class ExamStart(BaseModel):
    bank_ids: List[int]
    mode: str
    types: Optional[List[str]] = None
    choice_timeout: int = 30
    judge_fill_timeout: int = 60


class ExamCurrent(BaseModel):
    exam_id: int
    current_index: int
    total_count: int
    question: Optional[QuestionOut] = None
    is_answered: bool = False
    user_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    correct_answer: Optional[str] = None


class AnswerSubmit(BaseModel):
    exam_id: int
    question_id: int
    user_answer: Union[str, List[str], None] = None
    time_spent_seconds: int


class AnswerResult(BaseModel):
    is_correct: bool
    correct_answer: Union[str, List[str]]
    analysis: Optional[str] = None
    next_index: Optional[int] = None
    is_last: bool = False


class ExamResult(BaseModel):
    exam_id: int
    total_count: int
    correct_count: int
    wrong_count: int
    accuracy: float
    duration_seconds: int
    answers: List[dict]


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
    error: Optional[str] = None


class BatchImportResponse(BaseModel):
    results: List[ImportResult]


class DashboardData(BaseModel):
    total_banks: int = 0
    total_questions: int = 0
    total_exams: int = 0
    average_accuracy: float = 0
    recent_exams: List[HistoryItem] = []


class ReviewFilter(BaseModel):
    bank_ids: List[int]
    types: Optional[List[str]] = None
    chapter: Optional[str] = None
    show_reviewing_only: bool = False


class ReviewQuestionOut(BaseModel):
    id: int
    type: str
    chapter: Optional[str] = None
    content: str
    options: Optional[str] = None
    answer: str
    analysis: Optional[str] = None
    sort_order: int
    review_status: Optional[str] = None

    class Config:
        from_attributes = True


class MarkBody(BaseModel):
    question_id: int
    status: str


class ReviewStats(BaseModel):
    known_count: int = 0
    reviewing_count: int = 0
    total_reviewed: int = 0
