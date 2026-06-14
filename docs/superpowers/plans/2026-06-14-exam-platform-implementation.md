# 在线刷题平台 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 构建一个支持用户注册登录、题库管理（JSON 导入）、随机/顺序答题、多题库组合、单题计时、自动评分、错题记录和练习历史的在线刷题平台。

**架构:** FastAPI 后端 + SQLite 数据库 + Bootstrap 5 前端 SPA。前后端通过 REST JSON API 通信，JWT 认证。

**技术栈:** FastAPI, SQLAlchemy, SQLite, PyJWT, Bootstrap 5, vanilla JS

---

### Task 1: 项目骨架与数据库基础

**Files:**
- Create: `requirements.txt`
- Create: `database.py`

- [ ] **Step 1: 创建 requirements.txt**

```txt
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
pyjwt==2.10.1
passlib[bcrypt]==1.7.4
pydantic==2.10.3
python-multipart==0.0.19
aiofiles==24.1.0
```

- [ ] **Step 2: 创建 database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = "sqlite:///./exam.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 3: 创建 models.py** — 所有 ORM 模型

```python
import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey,
)
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    question_banks = relationship("QuestionBank", back_populates="user", cascade="all, delete-orphan")
    exam_records = relationship("ExamRecord", back_populates="user", cascade="all, delete-orphan")


class QuestionBank(Base):
    __tablename__ = "question_banks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="question_banks")
    questions = relationship("Question", back_populates="question_bank", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id"), nullable=False)
    type = Column(String(10), nullable=False)  # choice, fill, judge
    chapter = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    options = Column(Text, nullable=True)  # JSON string for choice type
    answer = Column(Text, nullable=False)  # string or JSON array for fill
    analysis = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)

    question_bank = relationship("QuestionBank", back_populates="questions")
    answer_records = relationship("AnswerRecord", back_populates="question")


class ExamRecord(Base):
    __tablename__ = "exam_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    bank_ids = Column(Text, nullable=False)  # JSON array
    mode = Column(String(10), nullable=False)  # random, sequential
    question_count = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    wrong_count = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    status = Column(String(15), default="in_progress")  # in_progress, completed
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="exam_records")
    answer_records = relationship("AnswerRecord", back_populates="exam", cascade="all, delete-orphan")


class AnswerRecord(Base):
    __tablename__ = "answer_records"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exam_records.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    user_answer = Column(Text, nullable=True)  # JSON
    is_correct = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, default=0)
    answered_at = Column(DateTime, default=datetime.datetime.utcnow)

    exam = relationship("ExamRecord", back_populates="answer_records")
    question = relationship("Question", back_populates="answer_records")
```

- [ ] **Step 4: 创建 schemas.py** — Pydantic 请求/响应模型

```python
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
    type: str  # choice, fill, judge
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
    mode: str  # random, sequential
    types: Optional[List[str]] = None  # choice, fill, judge
    choice_timeout: int = 30
    judge_fill_timeout: int = 60


class ExamCurrent(BaseModel):
    exam_id: int
    current_index: int
    total_count: int
    question: Optional[QuestionOut] = None


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


class DashboardData(BaseModel):
    total_banks: int = 0
    total_questions: int = 0
    total_exams: int = 0
    average_accuracy: float = 0
    recent_exams: List[HistoryItem] = []
```

- [ ] **Step 5: 验证导入**

Run: `python3 -c "from database import Base; from models import User, QuestionBank, Question, ExamRecord, AnswerRecord; print('Models OK')"`
Expected: `Models OK`

- [ ] **Step 6: Commit**

```bash
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add requirements.txt database.py models.py schemas.py
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：项目骨架与数据模型"
```

---

### Task 2: 认证模块

**Files:**
- Create: `auth.py`
- Create: `routers/__init__.py`
- Create: `routers/auth.py`

- [ ] **Step 1: 创建 auth.py** — JWT 工具函数

```python
import datetime
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User

SECRET_KEY = "exam-platform-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的 token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的 token")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user
```

- [ ] **Step 2: 创建 routers/__init__.py**（空文件）

- [ ] **Step 3: 创建 routers/auth.py**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserRegister, UserLogin, TokenResponse, UserInfo
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["认证"])


@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if len(data.username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少 2 个字符")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 个字符")
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"user_id": user.id})
    return TokenResponse(access_token=token, user=UserInfo(id=user.id, username=user.username))


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token({"user_id": user.id})
    return TokenResponse(access_token=token, user=UserInfo(id=user.id, username=user.username))


@router.get("/me", response_model=UserInfo)
def me(user: User = Depends(get_current_user)):
    return UserInfo(id=user.id, username=user.username)
```

- [ ] **Step 4: 创建 main.py** — FastAPI 应用入口

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from database import engine, Base
from routers import auth

Base.metadata.create_all(bind=engine)

app = FastAPI(title="刷题在线", version="1.0.0")

app.include_router(auth.router)
app.mount("/", StaticFiles(directory="static", html=True), name="static")


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: 验证启动**

Run: `pip install -r requirements.txt && python3 -c "from main import app; print('FastAPI app created OK')"`
Expected: `FastAPI app created OK`

- [ ] **Step 6: Commit**

```bash
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add auth.py routers/ main.py
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：认证模块与应用入口"
```

---

### Task 3: 题库管理路由

**Files:**
- Create: `routers/banks.py`

- [ ] **Step 1: 创建 banks.py** — 完整的题库 CRUD

```python
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, QuestionBank, Question
from schemas import BankImport, BankOut, BankDetail, QuestionOut
from auth import get_current_user

router = APIRouter(prefix="/api/question-banks", tags=["题库"])


@router.get("/", response_model=list[BankOut])
def list_banks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    banks = db.query(QuestionBank).filter(QuestionBank.user_id == user.id).order_by(QuestionBank.updated_at.desc()).all()
    result = []
    for bank in banks:
        result.append(BankOut(
            id=bank.id,
            title=bank.title,
            description=bank.description,
            question_count=len(bank.questions),
            created_at=bank.created_at.isoformat(),
            updated_at=bank.updated_at.isoformat(),
        ))
    return result


@router.get("/{bank_id}", response_model=BankDetail)
def get_bank(bank_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.user_id == user.id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    questions_out = []
    for q in bank.questions:
        questions_out.append(QuestionOut(
            id=q.id, type=q.type, chapter=q.chapter, content=q.content,
            options=q.options, answer=q.answer, analysis=q.analysis,
            sort_order=q.sort_order,
        ))
    return BankDetail(
        id=bank.id, title=bank.title, description=bank.description,
        question_count=len(bank.questions), questions=questions_out,
        created_at=bank.created_at.isoformat(),
        updated_at=bank.updated_at.isoformat(),
    )


@router.post("/import", response_model=BankOut, status_code=201)
def import_bank(data: BankImport, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bank = QuestionBank(user_id=user.id, title=data.title, description=data.description)
    db.add(bank)
    db.flush()
    for i, q in enumerate(data.questions):
        options_str = json.dumps(q.options, ensure_ascii=False) if q.options else None
        answer_str = json.dumps(q.answer, ensure_ascii=False) if isinstance(q.answer, list) else q.answer
        question = Question(
            bank_id=bank.id, type=q.type, chapter=q.chapter or None,
            content=q.content, options=options_str, answer=answer_str,
            analysis=q.analysis or None, sort_order=i,
        )
        db.add(question)
    db.commit()
    db.refresh(bank)
    return BankOut(
        id=bank.id, title=bank.title, description=bank.description,
        question_count=len(data.questions),
        created_at=bank.created_at.isoformat(),
        updated_at=bank.updated_at.isoformat(),
    )


@router.delete("/{bank_id}", status_code=204)
def delete_bank(bank_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bank = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id, QuestionBank.user_id == user.id
    ).first()
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    db.delete(bank)
    db.commit()
```

- [ ] **Step 2: 注册路由到 main.py**

在 `main.py` 中添加：
```python
from routers import auth, banks
# ...
app.include_router(auth.router)
app.include_router(banks.router)  # 新增
```

- [ ] **Step 3: 验证**

Run: `python3 -c "from routers.banks import router; print('Banks router OK')"`
Expected: `Banks router OK`

- [ ] **Step 4: Commit**

```bash
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add routers/banks.py main.py
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：题库管理路由"
```

---

### Task 4: 答题流程路由

**Files:**
- Create: `routers/exam.py`

- [ ] **Step 1: 创建 exam.py**

```python
import json
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, QuestionBank, Question, ExamRecord, AnswerRecord
from schemas import ExamStart, ExamCurrent, QuestionOut, AnswerSubmit, AnswerResult, ExamResult
from auth import get_current_user

router = APIRouter(prefix="/api/exam", tags=["答题"])


def _serialize_question(q: Question) -> QuestionOut:
    return QuestionOut(
        id=q.id, type=q.type, chapter=q.chapter, content=q.content,
        options=q.options, answer=q.answer, analysis=q.analysis,
        sort_order=q.sort_order,
    )


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

    if data.mode == "random":
        random.shuffle(questions)
    else:
        questions.sort(key=lambda q: (q.bank_id or 0, q.sort_order or 0, q.id or 0))

    exam = ExamRecord(
        user_id=user.id,
        bank_ids=json.dumps(data.bank_ids),
        mode=data.mode,
        question_count=len(questions),
        status="in_progress",
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    answers_data = []
    for q in questions:
        answers_data.append({
            "exam_id": exam.id,
            "question_id": q.id,
        })
    exam._question_queue = questions
    exam._current_index = 0

    return {"exam_id": exam.id, "total_count": len(questions)}


def _get_exam(exam_id: int, user: User, db: Session) -> tuple[ExamRecord, list[Question], int]:
    exam = db.query(ExamRecord).filter(
        ExamRecord.id == exam_id, ExamRecord.user_id == user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="练习记录不存在")

    bank_ids = json.loads(exam.bank_ids)
    banks = db.query(QuestionBank).filter(QuestionBank.id.in_(bank_ids)).all()
    questions = []
    for bank in banks:
        questions.extend(bank.questions)

    if exam.mode == "random":
        random.seed(exam.id)
        random.shuffle(questions)
    else:
        questions.sort(key=lambda q: (q.bank_id or 0, q.sort_order or 0, q.id or 0))

    answered = db.query(AnswerRecord).filter(
        AnswerRecord.exam_id == exam.id
    ).all()
    answered_ids = {a.question_id for a in answered}
    questions = [q for q in questions if q.id not in answered_ids]

    return exam, questions, len(answered)


@router.get("/{exam_id}/current")
def current_question(exam_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exam, questions, answered_count = _get_exam(exam_id, user, db)
    if not questions:
        return ExamCurrent(exam_id=exam.id, current_index=answered_count, total_count=exam.question_count, question=None)
    q = questions[0]
    q_out = _serialize_question(q)
    q_out.answer = None
    q_out.analysis = None
    return ExamCurrent(
        exam_id=exam.id, current_index=answered_count + 1,
        total_count=exam.question_count, question=q_out,
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

    user_answer_str = json.dumps(data.user_answer, ensure_ascii=False) if isinstance(data.user_answer, list) else data.user_answer
    correct_answer = json.loads(question.answer) if question.answer and question.answer.startswith("[") else question.answer

    if question.type == "choice":
        is_correct = data.user_answer == correct_answer
    elif question.type == "judge":
        is_correct = data.user_answer == correct_answer
    elif question.type == "fill":
        if isinstance(correct_answer, list):
            user_list = data.user_answer if isinstance(data.user_answer, list) else [data.user_answer]
            is_correct = len(user_list) == len(correct_answer) and all(
                u.strip() == c.strip() for u, c in zip(user_list, correct_answer)
            )
        else:
            is_correct = (data.user_answer or "").strip() == correct_answer.strip()
    else:
        is_correct = False

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
    db.commit()

    _, remaining, answered_count = _get_exam(exam.id, user, db)
    is_last = len(remaining) == 0

    if is_last:
        exam.status = "completed"
        exam.finished_at = __import__("datetime").datetime.utcnow()
        db.commit()

    correct_display = correct_answer
    if isinstance(correct_answer, list):
        correct_display = correct_answer

    return AnswerResult(
        is_correct=is_correct,
        correct_answer=correct_display,
        analysis=question.analysis,
        next_index=answered_count + 1 if not is_last else None,
        is_last=is_last,
    )


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

    def _get_answer(q_id: int) -> Question:
        return db.query(Question).filter(Question.id == q_id).first()

    result_answers = []
    for a in answers:
        q = _get_answer(a.question_id)
        correct_answer = json.loads(q.answer) if q.answer and q.answer.startswith("[") else q.answer
        user_answer = json.loads(a.user_answer) if a.user_answer and a.user_answer.startswith("[") else a.user_answer
        result_answers.append({
            "question_id": q.id,
            "type": q.type,
            "content": q.content,
            "options": json.loads(q.options) if q.options else None,
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
        duration_seconds=exam.duration_seconds,
        answers=result_answers,
    )
```

- [ ] **Step 2: 注册路由到 main.py**

```python
from routers import auth, banks, exam
# ...
app.include_router(exam.router)
```

- [ ] **Step 3: 验证**

Run: `python3 -c "from routers.exam import router; print('Exam router OK')"`
Expected: `Exam router OK`

- [ ] **Step 4: Commit**

```bash
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add routers/exam.py main.py
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：答题流程路由"
```

---

### Task 5: 历史、错题与仪表盘路由

**Files:**
- Create: `routers/history.py`
- Create: `routers/dashboard.py`

- [ ] **Step 1: 创建 history.py**

```python
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, ExamRecord, AnswerRecord, Question
from schemas import HistoryItem, ExamResult
from auth import get_current_user
from routers.exam import exam_result as _exam_result

router = APIRouter(prefix="/api/history", tags=["练习历史"])


@router.get("/", response_model=list[HistoryItem])
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
            duration_seconds=r.duration_seconds,
            started_at=r.started_at.isoformat(),
        ))
    return result


@router.get("/{exam_id}", response_model=ExamResult)
def history_detail(exam_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _exam_result(exam_id, user, db)
```

- [ ] **Step 2: 创建 dashboard.py**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import get_db
from models import User, QuestionBank, ExamRecord, Question
from schemas import DashboardData, HistoryItem
from auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["仪表盘"])


@router.get("/", response_model=DashboardData)
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

    exams = (
        db.query(ExamRecord)
        .filter(ExamRecord.user_id == user.id, ExamRecord.status == "completed")
        .order_by(desc(ExamRecord.started_at))
        .all()
    )

    total_exams = len(exams)
    total_correct = sum(e.correct_count for e in exams)
    total_questions_done = sum(e.correct_count + e.wrong_count for e in exams)
    average_accuracy = round(total_correct / total_questions_done, 4) if total_questions_done > 0 else 0

    recent = []
    for r in exams[:5]:
        total = r.correct_count + r.wrong_count
        accuracy = round(r.correct_count / total, 4) if total > 0 else 0
        recent.append(HistoryItem(
            id=r.id, bank_ids=r.bank_ids, mode=r.mode,
            question_count=r.question_count,
            correct_count=r.correct_count, wrong_count=r.wrong_count,
            accuracy=accuracy, duration_seconds=r.duration_seconds,
            started_at=r.started_at.isoformat(),
        ))

    return DashboardData(
        total_banks=bank_count,
        total_questions=question_count,
        total_exams=total_exams,
        average_accuracy=average_accuracy,
        recent_exams=recent,
    )
```

- [ ] **Step 3: 创建错题路由 (routers/wrong_answers.py)**

```python
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, AnswerRecord, Question, QuestionBank
from auth import get_current_user

router = APIRouter(prefix="/api/wrong-answers", tags=["错题"])


@router.get("/")
def list_wrong(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = (
        db.query(AnswerRecord)
        .join(Question)
        .filter(
            AnswerRecord.is_correct == False,
            AnswerRecord.exam_id.in_(
                db.query(AnswerRecord.exam_id).join(ExamRecord).filter(
                    ExamRecord.user_id == user.id
                ).distinct()
            ),
        )
        .order_by(desc(AnswerRecord.answered_at))
        .all()
    )

    from models import ExamRecord

    records = (
        db.query(AnswerRecord)
        .join(ExamRecord)
        .filter(
            ExamRecord.user_id == user.id,
            AnswerRecord.is_correct == False,
        )
        .order_by(desc(AnswerRecord.answered_at))
        .all()
    )

    seen_q = set()
    result = []
    for r in records:
        if r.question_id in seen_q:
            continue
        seen_q.add(r.question_id)
        q = r.question
        correct_answer = json.loads(q.answer) if q.answer and q.answer.startswith("[") else q.answer
        user_answer = json.loads(r.user_answer) if r.user_answer and r.user_answer.startswith("[") else r.user_answer
        result.append({
            "question_id": q.id,
            "bank_title": q.question_bank.title if q.question_bank else "",
            "type": q.type,
            "chapter": q.chapter,
            "content": q.content,
            "options": json.loads(q.options) if q.options else None,
            "correct_answer": correct_answer,
            "user_answer": user_answer,
            "analysis": q.analysis,
        })
    return result
```

注意：需要在文件顶部添加 `from models import ExamRecord`。

- [ ] **Step 4: 注册所有新路由到 main.py**

```python
from routers import auth, banks, exam, history, dashboard, wrong_answers
# ...
app.include_router(auth.router)
app.include_router(banks.router)
app.include_router(exam.router)
app.include_router(history.router)
app.include_router(dashboard.router)
app.include_router(wrong_answers.router)
```

- [ ] **Step 5: 验证**

Run: `python3 -c "from main import app; print('All routers registered OK')"`
Expected: `All routers registered OK`

- [ ] **Step 6: Commit**

```bash
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add routers/history.py routers/dashboard.py routers/wrong_answers.py main.py
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：历史、仪表盘与错题路由"
```

---

### Task 6: 前端 API 层 (api.js)

**Files:**
- Create: `static/js/api.js`

- [ ] **Step 1: 创建 api.js**

```javascript
const API_BASE = '/api';

const api = {
  token: localStorage.getItem('token'),

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const opts = { method, headers };
    if (body !== null) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) {
      const msg = data.detail || '请求失败';
      throw new Error(msg);
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  delete(path) { return this.request('DELETE', path); },

  // 认证
  register(username, password) { return this.post('/auth/register', { username, password }); },
  login(username, password) { return this.post('/auth/login', { username, password }); },
  me() { return this.get('/auth/me'); },

  // 题库
  getBanks() { return this.get('/question-banks'); },
  getBank(id) { return this.get(`/question-banks/${id}`); },
  importBank(data) { return this.post('/question-banks/import', data); },
  deleteBank(id) { return this.delete(`/question-banks/${id}`); },

  // 答题
  startExam(data) { return this.post('/exam/start', data); },
  getCurrentQuestion(examId) { return this.get(`/exam/${examId}/current`); },
  submitAnswer(examId, questionId, userAnswer, timeSpent) {
    return this.post(`/exam/${examId}/answer`, {
      exam_id: examId,
      question_id: questionId,
      user_answer: userAnswer,
      time_spent_seconds: timeSpent,
    });
  },
  getExamResult(examId) { return this.get(`/exam/${examId}/result`); },

  // 历史
  getHistory(page = 1) { return this.get(`/history?page=${page}&page_size=20`); },
  getHistoryDetail(examId) { return this.get(`/history/${examId}`); },

  // 错题
  getWrongAnswers() { return this.get('/wrong-answers'); },

  // 仪表盘
  getDashboard() { return this.get('/dashboard'); },
};
```

- [ ] **Step 2: 验证文件创建**

Run: `ls -la static/js/api.js`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add static/js/api.js
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：前端 API 层"
```

---

### Task 7: 前端 SPA 路由与状态管理 (app.js)

**Files:**
- Create: `static/js/app.js`
- Create: `static/css/style.css`

- [ ] **Step 1: 创建 app.js** — 核心 SPA 引擎

```javascript
// SPA 路由
class Router {
  constructor() {
    this.routes = {};
    window.addEventListener('hashchange', () => this.resolve());
  }

  add(path, handler) {
    const pattern = path.replace(/:([^/]+)/g, '(?<$1>[^/]+)');
    this.routes[path] = { pattern: new RegExp(`^${pattern}$`), handler };
  }

  resolve() {
    const hash = location.hash.replace(/^#/, '') || '/login';
    for (const [, route] of Object.entries(this.routes)) {
      const match = hash.match(route.pattern);
      if (match) {
        route.handler(match.groups || {});
        return;
      }
    }
    document.getElementById('content').innerHTML = '<h2 class="mt-5 text-center">404 - 页面未找到</h2>';
  }

  navigate(path) {
    location.hash = path;
  }
}

// 应用状态
const state = {
  user: null,
  timerInterval: null,
  currentExam: null,
  questionStartTime: null,
};

const router = new Router();
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// 检查登录态
async function checkAuth() {
  if (!api.token) return false;
  try {
    state.user = await api.me();
    return true;
  } catch {
    api.setToken(null);
    return false;
  }
}

// 登录
router.add('/login', async () => {
  render(`
    <div class="auth-page">
      <div class="auth-card">
        <h1 class="auth-logo">刷题在线</h1>
        <p class="text-muted mb-4">登录你的账号</p>
        <div id="auth-error" class="alert alert-danger d-none"></div>
        <form id="login-form">
          <div class="mb-3">
            <label class="form-label">用户名</label>
            <input type="text" class="form-control" id="login-username" required autocomplete="username">
          </div>
          <div class="mb-3">
            <label class="form-label">密码</label>
            <input type="password" class="form-control" id="login-password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary w-100 btn-lg">登 录</button>
        </form>
        <p class="text-center mt-3 mb-0">
          还没有账号？<a href="#/register">去注册</a>
        </p>
      </div>
    </div>
  `);
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerHTML = '登录中...';
    try {
      const res = await api.login(username, password);
      api.setToken(res.access_token);
      state.user = res.user;
      router.navigate('/dashboard');
    } catch (err) {
      const errDiv = document.getElementById('auth-error');
      errDiv.textContent = err.message;
      errDiv.classList.remove('d-none');
    } finally {
      btn.disabled = false; btn.innerHTML = '登 录';
    }
  });
});

// 注册
router.add('/register', () => {
  render(`
    <div class="auth-page">
      <div class="auth-card">
        <h1 class="auth-logo">刷题在线</h1>
        <p class="text-muted mb-4">创建新账号</p>
        <div id="auth-error" class="alert alert-danger d-none"></div>
        <form id="register-form">
          <div class="mb-3">
            <label class="form-label">用户名</label>
            <input type="text" class="form-control" id="reg-username" required autocomplete="username">
          </div>
          <div class="mb-3">
            <label class="form-label">密码</label>
            <input type="password" class="form-control" id="reg-password" required minlength="6" autocomplete="new-password">
          </div>
          <div class="mb-3">
            <label class="form-label">确认密码</label>
            <input type="password" class="form-control" id="reg-confirm" required autocomplete="new-password">
          </div>
          <button type="submit" class="btn btn-primary w-100 btn-lg">注 册</button>
        </form>
        <p class="text-center mt-3 mb-0">
          已有账号？<a href="#/login">去登录</a>
        </p>
      </div>
    </div>
  `);
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    if (password !== confirm) {
      document.getElementById('auth-error').textContent = '两次密码不一致';
      document.getElementById('auth-error').classList.remove('d-none');
      return;
    }
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerHTML = '注册中...';
    try {
      const res = await api.register(username, password);
      api.setToken(res.access_token);
      state.user = res.user;
      router.navigate('/dashboard');
    } catch (err) {
      const errDiv = document.getElementById('auth-error');
      errDiv.textContent = err.message;
      errDiv.classList.remove('d-none');
    } finally {
      btn.disabled = false; btn.innerHTML = '注 册';
    }
  });
});

// 仪表盘
router.add('/dashboard', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const data = await api.getDashboard();
    render(`
      <div class="page-header">
        <h2>欢迎回来，${state.user.username} <a href="#/exam/setup" class="btn btn-primary btn-lg ms-3">开始刷题</a></h2>
      </div>
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-number">${data.total_banks}</div><div class="stat-label">题库数</div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-number">${data.total_questions}</div><div class="stat-label">总题数</div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-number">${data.total_exams}</div><div class="stat-label">练习次数</div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-number">${(data.average_accuracy * 100).toFixed(0)}%</div><div class="stat-label">正确率</div></div>
        </div>
      </div>
      <h3 class="mb-3">最近练习</h3>
      <div id="recent-exams">${data.recent_exams.length === 0 ? '<p class="text-muted">还没有练习记录</p>' : ''}</div>
    `);
    if (data.recent_exams.length > 0) {
      const list = document.getElementById('recent-exams');
      data.recent_exams.forEach(ex => {
        const date = new Date(ex.started_at).toLocaleString('zh-CN');
        const acc = (ex.accuracy * 100).toFixed(0);
        list.innerHTML += `
          <div class="history-item" onclick="router.navigate('/history/${ex.id}')">
            <div class="d-flex justify-content-between align-items-center">
              <div><strong>${date}</strong> · ${ex.mode === 'random' ? '随机' : '顺序'}模式</div>
              <div><span class="badge bg-success">${ex.correct_count}/${ex.question_count}</span> ${acc}%</div>
            </div>
          </div>
        `;
      });
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

// 题库管理
router.add('/banks', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const banks = await api.getBanks();
    render(`
      <div class="page-header">
        <h2>题库管理</h2>
        <div>
          <button class="btn btn-outline-primary me-2" onclick="showImportModal()">导入题库</button>
          <button class="btn btn-outline-secondary" onclick="downloadSample()">下载示例 JSON</button>
        </div>
      </div>
      ${banks.length === 0 ? '<div class="empty-state"><p>还没有题库</p><p class="text-muted">点击"导入题库"开始</p></div>' : ''}
      <div class="row g-3" id="bank-list"></div>
      <!-- 导入弹窗 -->
      <div class="modal fade" id="importModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">导入题库</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">选择 JSON 文件</label>
              <input type="file" class="form-control" id="import-file" accept=".json">
            </div>
            <div id="import-preview"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
            <button class="btn btn-primary" id="import-btn" disabled onclick="doImport()">确认导入</button>
          </div>
        </div></div>
      </div>
    `);
    const list = document.getElementById('bank-list');
    banks.forEach(b => {
      list.innerHTML += `
        <div class="col-md-6 col-lg-4">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">${escHtml(b.title)}</h5>
              <p class="card-text text-muted">${b.question_count} 题 · ${b.description ? escHtml(b.description) : ''}</p>
              <p class="card-text"><small class="text-muted">更新于 ${new Date(b.updated_at).toLocaleDateString('zh-CN')}</small></p>
              <a href="#/banks/${b.id}" class="btn btn-outline-primary btn-sm">详情</a>
              <button class="btn btn-outline-danger btn-sm ms-1" onclick="confirmDeleteBank(${b.id}, '${escHtml(b.title)}')">删除</button>
            </div>
          </div>
        </div>
      `;
    });
    document.getElementById('import-file').addEventListener('change', previewImport);
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

// 题库详情
router.add('/banks/:id', async ({ id }) => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const bank = await api.getBank(id);
    render(`
      <div class="page-header">
        <h2><a href="#/banks" class="text-decoration-none me-2">←</a> ${escHtml(bank.title)}</h2>
        <p class="text-muted">共 ${bank.question_count} 题 · ${bank.description || ''}</p>
      </div>
      <div id="questions-by-chapter"></div>
    `);
    const chapters = {};
    bank.questions.forEach(q => {
      const ch = q.chapter || '未分类';
      if (!chapters[ch]) chapters[ch] = [];
      chapters[ch].push(q);
    });
    const container = document.getElementById('questions-by-chapter');
    for (const [ch, qs] of Object.entries(chapters)) {
      let html = `<h5 class="mt-3 mb-2">${escHtml(ch)} (${qs.length} 题)</h5>`;
      qs.forEach(q => {
        const typeMap = { choice: '选择', fill: '填空', judge: '判断' };
        html += `<div class="question-item">
          <span class="badge bg-secondary me-2">${typeMap[q.type] || q.type}</span>
          ${escHtml(q.content)}
        </div>`;
      });
      container.innerHTML += html;
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

// 答题设置
router.add('/exam/setup', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const banks = await api.getBanks();
    if (banks.length === 0) {
      render('<div class="empty-state"><p>还没有题库</p><p class="text-muted">请先导入题库</p><a href="#/banks" class="btn btn-primary">去导入</a></div>');
      return;
    }
    render(`
      <div class="page-header"><h2>答题设置</h2></div>
      <div class="card mb-4"><div class="card-body">
        <h5>选择题库</h5>
        <div id="bank-select" class="row g-2"></div>
        <p class="mt-2 text-muted" id="selected-count">已选 0 个题库</p>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>答题模式</h5>
        <div class="d-flex gap-3 mt-2">
          <div class="mode-card ${bank => ''}" data-mode="sequential" onclick="selectMode(this)">顺序模式 <small class="d-block text-muted">按章节顺序出题</small></div>
          <div class="mode-card active" data-mode="random" onclick="selectMode(this)">随机模式 <small class="d-block text-muted">随机打乱出题</small></div>
        </div>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>题型筛选</h5>
        <div class="d-flex gap-3 mt-2">
          <label class="form-check-label"><input type="checkbox" class="form-check-input me-1 type-filter" value="choice" checked> 选择题</label>
          <label class="form-check-label"><input type="checkbox" class="form-check-input me-1 type-filter" value="fill" checked> 填空题</label>
          <label class="form-check-label"><input type="checkbox" class="form-check-input me-1 type-filter" value="judge" checked> 判断题</label>
        </div>
      </div></div>
      <div class="card mb-4"><div class="card-body">
        <h5>单题计时</h5>
        <div class="row g-3 mt-1">
          <div class="col-auto"><label class="form-label">选择题</label><input type="number" class="form-control" id="timeout-choice" value="30" min="10" max="300"></div>
          <div class="col-auto"><label class="form-label">填空/判断</label><input type="number" class="form-control" id="timeout-fill" value="60" min="10" max="300"></div>
        </div>
      </div></div>
      <button class="btn btn-primary btn-lg w-100" onclick="startExam()">开始答题</button>
    `);
    const bankSelect = document.getElementById('bank-select');
    banks.forEach(b => {
      bankSelect.innerHTML += `
        <div class="col-md-4 col-6">
          <div class="bank-check-card" data-id="${b.id}" onclick="toggleBankSelect(this)">
            <div class="form-check">
              <input type="checkbox" class="form-check-input bank-checkbox" value="${b.id}">
              <label class="form-check-label">${escHtml(b.title)} <span class="text-muted">(${b.question_count} 题)</span></label>
            </div>
          </div>
        </div>
      `;
    });
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

// 答题中
let examQuestionQueue = [];
let examCurrentIndex = 0;
let examTimerInterval = null;
let examTimeoutSeconds = 30;
let examId = null;

router.add('/exam', () => {
  showNav();
  if (!examId) { router.navigate('/exam/setup'); return; }
  render(`
    <div class="exam-container">
      <div class="exam-header">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span id="exam-progress-text">第 0/0 题</span>
          <span id="exam-timer" class="exam-timer">0:00</span>
        </div>
        <div class="progress exam-progress"><div id="exam-progress-bar" class="progress-bar" style="width:0%"></div></div>
      </div>
      <div id="exam-content" class="text-center py-5"><div class="spinner-border"></div></div>
    </div>
  `);
  loadNextQuestion();
});

// 答题结果
router.add('/result/:id', async ({ id }) => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const result = await api.getExamResult(id);
    const acc = (result.accuracy * 100).toFixed(0);
    render(`
      <div class="page-header text-center">
        <h2 class="result-title">答题完成！</h2>
        <div class="result-score">${acc}<small>分</small></div>
      </div>
      <div class="row g-3 mb-4">
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number text-success">${result.correct_count}</div><div class="stat-label">正确</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number text-danger">${result.wrong_count}</div><div class="stat-label">错误</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number">${acc}%</div><div class="stat-label">正确率</div></div></div>
        <div class="col-3 col-md-3"><div class="stat-card"><div class="stat-number">${result.duration_seconds}s</div><div class="stat-label">用时</div></div></div>
      </div>
      <div id="result-answers"></div>
      <div class="d-flex gap-2 mt-3">
        <a href="#/exam/setup" class="btn btn-primary">再来一次</a>
        <a href="#/history/${result.exam_id}" class="btn btn-outline-primary">查看详情</a>
        <a href="#/dashboard" class="btn btn-outline-secondary">返回首页</a>
      </div>
    `);
    const container = document.getElementById('result-answers');
    result.answers.forEach((a, i) => {
      const icon = a.is_correct ? '<span class="text-success">✓</span>' : '<span class="text-danger">✗</span>';
      const userAns = Array.isArray(a.user_answer) ? a.user_answer.join(', ') : a.user_answer || '(未作答)';
      const correctAns = Array.isArray(a.correct_answer) ? a.correct_answer.join(', ') : a.correct_answer;
      container.innerHTML += `
        <div class="answer-review-item ${a.is_correct ? 'correct' : 'wrong'}">
          <div class="d-flex justify-content-between">
            <strong>第 ${i + 1} 题 ${icon}</strong>
            <small class="text-muted">${a.time_spent || 0}s</small>
          </div>
          <p class="mb-1 mt-1">${escHtml(a.content)}</p>
          <p class="mb-0 small"><span class="text-danger">你的答案: ${escHtml(userAns)}</span></p>
          ${!a.is_correct ? `<p class="mb-0 small text-success">正确答案: ${escHtml(correctAns)}</p>` : ''}
          ${a.analysis ? `<p class="mb-0 small text-muted mt-1">解析: ${escHtml(a.analysis)}</p>` : ''}
        </div>
      `;
    });
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

// 练习历史
router.add('/history', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const list = await api.getHistory();
    render(`
      <div class="page-header"><h2>练习历史</h2></div>
      ${list.length === 0 ? '<div class="empty-state"><p>还没有练习记录</p></div>' : ''}
      <div id="history-list"></div>
    `);
    if (list.length > 0) {
      const container = document.getElementById('history-list');
      list.forEach(h => {
        const date = new Date(h.started_at).toLocaleString('zh-CN');
        const acc = (h.accuracy * 100).toFixed(0);
        container.innerHTML += `
          <div class="history-item" onclick="router.navigate('/history/${h.id}')">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong>${date}</strong>
                <span class="badge bg-secondary ms-2">${h.mode === 'random' ? '随机' : '顺序'}</span>
                <span class="text-muted ms-2">${h.question_count} 题</span>
              </div>
              <div><span class="badge bg-success">${h.correct_count}/${h.question_count}</span> ${acc}% · ${h.duration_seconds}s</div>
            </div>
          </div>
        `;
      });
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

// 历史详情
router.add('/history/:id', async ({ id }) => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const result = await api.getHistoryDetail(id);
    const date = new Date(result.answers[0]?.time_spent ? Date.now() : Date.now()).toLocaleString('zh-CN');
    const acc = (result.accuracy * 100).toFixed(0);
    render(`
      <div class="page-header">
        <h2><a href="#/history" class="text-decoration-none me-2">←</a>练习回顾</h2>
        <p class="text-muted">${result.correct_count}/${result.total_count} 正确 · ${acc}% · ${result.duration_seconds}s</p>
      </div>
      <div id="history-answers"></div>
      <div class="mt-3"><a href="#/exam/setup" class="btn btn-primary">重新练习</a></div>
    `);
    const container = document.getElementById('history-answers');
    result.answers.forEach((a, i) => {
      const icon = a.is_correct ? '<span class="text-success">✓</span>' : '<span class="text-danger">✗</span>';
      const userAns = Array.isArray(a.user_answer) ? a.user_answer.join(', ') : a.user_answer || '(未作答)';
      const correctAns = Array.isArray(a.correct_answer) ? a.correct_answer.join(', ') : a.correct_answer;
      container.innerHTML += `
        <div class="answer-review-item ${a.is_correct ? 'correct' : 'wrong'}">
          <div class="d-flex justify-content-between">
            <strong>第 ${i + 1} 题 ${icon}</strong>
            <small class="text-muted">${a.time_spent || 0}s</small>
          </div>
          <p class="mb-1 mt-1">${escHtml(a.content)}</p>
          <p class="mb-0 small"><span class="text-danger">你的答案: ${escHtml(userAns)}</span></p>
          ${!a.is_correct ? `<p class="mb-0 small text-success">正确答案: ${escHtml(correctAns)}</p>` : ''}
          ${a.analysis ? `<p class="mb-0 small text-muted mt-1">解析: ${escHtml(a.analysis)}</p>` : ''}
        </div>
      `;
    });
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

// 错题本
router.add('/wrong-answers', async () => {
  showNav();
  render('<div class="text-center py-5"><div class="spinner-border"></div></div>');
  try {
    const wrongs = await api.getWrongAnswers();
    render(`
      <div class="page-header"><h2>错题本</h2><span class="text-muted">共 ${wrongs.length} 道错题</span></div>
      ${wrongs.length === 0 ? '<div class="empty-state"><p>太棒了，还没有错题！</p></div>' : ''}
      <div id="wrong-list"></div>
    `);
    if (wrongs.length > 0) {
      const container = document.getElementById('wrong-list');
      let currentBank = '';
      wrongs.forEach(w => {
        if (w.bank_title !== currentBank) {
          currentBank = w.bank_title;
          container.innerHTML += `<h5 class="mt-3 mb-2">${escHtml(currentBank)}</h5>`;
        }
        const userAns = Array.isArray(w.user_answer) ? w.user_answer.join(', ') : w.user_answer || '(未作答)';
        const correctAns = Array.isArray(w.correct_answer) ? w.correct_answer.join(', ') : w.correct_answer;
        container.innerHTML += `
          <div class="answer-review-item wrong">
            <p class="mb-1"><span class="badge bg-danger me-1">✗</span> ${escHtml(w.content)}</p>
            <p class="mb-0 small text-danger">你的答案: ${escHtml(userAns)}</p>
            <p class="mb-0 small text-success">正确答案: ${escHtml(correctAns)}</p>
            ${w.analysis ? `<p class="mb-0 small text-muted mt-1">解析: ${escHtml(w.analysis)}</p>` : ''}
          </div>
        `;
      });
    }
  } catch {
    render('<div class="alert alert-danger">加载失败</div>');
  }
});

// 工具函数
function render(html) {
  document.getElementById('content').innerHTML = html;
}

function showNav() {
  document.getElementById('navbar').classList.remove('d-none');
  document.getElementById('nav-username').textContent = state.user ? state.user.username : '';
  // 高亮当前导航
  $$('.nav-link').forEach(el => el.classList.remove('active'));
  const hash = location.hash.split('?')[0];
  document.querySelectorAll(`.nav-link[href="${hash}"]`).forEach(el => el.classList.add('active'));
}

function escHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// 全局函数（由 HTML onclick 调用）
function logout() {
  api.setToken(null);
  state.user = null;
  router.navigate('/login');
}

// 答题相关全局函数
function selectMode(el) {
  $$('.mode-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function toggleBankSelect(el) {
  const cb = el.querySelector('.bank-checkbox');
  cb.checked = !cb.checked;
  el.classList.toggle('selected');
  const count = document.querySelectorAll('.bank-checkbox:checked').length;
  document.getElementById('selected-count').textContent = `已选 ${count} 个题库`;
}

async function startExam() {
  const selectedBanks = [...document.querySelectorAll('.bank-checkbox:checked')].map(cb => parseInt(cb.value));
  if (selectedBanks.length === 0) { alert('请至少选择一个题库'); return; }
  const mode = document.querySelector('.mode-card.active')?.dataset.mode || 'random';
  const types = [...document.querySelectorAll('.type-filter:checked')].map(cb => cb.value);
  const choiceTimeout = parseInt(document.getElementById('timeout-choice').value) || 30;
  const fillTimeout = parseInt(document.getElementById('timeout-fill').value) || 60;
  try {
    const res = await api.startExam({ bank_ids: selectedBanks, mode, types, choice_timeout: choiceTimeout, judge_fill_timeout: fillTimeout });
    examId = res.exam_id;
    examTotalCount = res.total_count;
    examQuestionQueue = [];
    examCurrentIndex = 0;
    router.navigate('/exam');
  } catch (err) {
    alert(err.message);
  }
}

let examTotalCount = 0;

async function loadNextQuestion() {
  if (examTimerInterval) clearInterval(examTimerInterval);
  if (!examId) return;
  try {
    const data = await api.getCurrentQuestion(examId);
    if (!data.question) {
      router.navigate(`/result/${examId}`);
      return;
    }
    document.getElementById('exam-progress-text').textContent = `第 ${data.current_index}/${data.total_count} 题`;
    document.getElementById('exam-progress-bar').style.width = `${((data.current_index - 1) / data.total_count) * 100}%`;

    // 设置计时
    const isChoice = data.question.type === 'choice';
    examTimeoutSeconds = isChoice ? (parseInt(document.getElementById('timeout-choice')?.value) || 30) : (parseInt(document.getElementById('timeout-fill')?.value) || 60);
    state.questionStartTime = Date.now();

    const q = data.question;
    const typeMap = { choice: '选择题', fill: '填空题', judge: '判断题' };
    let optionsHtml = '';
    if (q.type === 'choice') {
      const opts = JSON.parse(q.options || '[]');
      opts.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        optionsHtml += `<div class="choice-option" onclick="selectChoice(this, '${letter}')">${escHtml(opt)}</div>`;
      });
    } else if (q.type === 'judge') {
      optionsHtml = `
        <div class="d-flex gap-3 justify-content-center mt-3">
          <div class="choice-option" onclick="selectChoice(this, '对')">对</div>
          <div class="choice-option" onclick="selectChoice(this, '错')">错</div>
        </div>
      `;
    } else if (q.type === 'fill') {
      // fill: 暂显示一个输入框（多空未实现,show single input for simplicity）
      optionsHtml = `<input type="text" class="form-control form-control-lg mt-3" id="fill-answer" placeholder="请输入答案">`;
    }

    document.getElementById('exam-content').innerHTML = `
      <div class="exam-question">
        <div class="mb-3">
          <span class="badge bg-primary me-2">${typeMap[q.type] || q.type}</span>
          ${q.chapter ? `<span class="badge bg-secondary">${escHtml(q.chapter)}</span>` : ''}
        </div>
        <h4 class="mb-4">${escHtml(q.content)}</h4>
        <div id="options-area">${optionsHtml}</div>
        <button class="btn btn-primary btn-lg mt-4" id="submit-answer-btn" onclick="submitCurrentAnswer()" disabled>提交答案</button>
      </div>
    `;

    // 填空多空处理: 如果 answer 是 JSON 数组，生成多个输入框
    if (q.type === 'fill') {
      const answerRaw = q.answer;
      try {
        const parsed = JSON.parse(answerRaw);
        if (Array.isArray(parsed) && parsed.length > 1) {
          let multiHtml = '<div class="d-flex flex-wrap gap-2 mt-3 justify-content-center">';
          parsed.forEach((_, i) => {
            multiHtml += `<input type="text" class="form-control fill-input" style="width:120px;display:inline-block" data-idx="${i}" placeholder="空 ${i + 1}">`;
          });
          multiHtml += '</div>';
          document.getElementById('options-area').innerHTML = multiHtml;
        }
      } catch {}
      document.getElementById('submit-answer-btn').disabled = false;
    }

    startTimer();
  } catch {
    document.getElementById('exam-content').innerHTML = '<div class="alert alert-danger">加载题目失败</div>';
  }
}

let selectedAnswer = null;

function selectChoice(el, value) {
  $$('.choice-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAnswer = value;
  document.getElementById('submit-answer-btn').disabled = false;
}

function startTimer() {
  let remaining = examTimeoutSeconds;
  document.getElementById('exam-timer').textContent = formatTime(remaining);
  document.getElementById('exam-timer').className = 'exam-timer';
  if (examTimerInterval) clearInterval(examTimerInterval);
  examTimerInterval = setInterval(() => {
    remaining--;
    document.getElementById('exam-timer').textContent = formatTime(remaining);
    if (remaining <= 10) document.getElementById('exam-timer').classList.add('timer-danger');
    else if (remaining <= 30) document.getElementById('exam-timer').classList.add('timer-warning');
    if (remaining <= 0) {
      clearInterval(examTimerInterval);
      submitCurrentAnswer();
    }
  }, 1000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function submitCurrentAnswer() {
  if (!examId) return;
  clearInterval(examTimerInterval);
  const btn = document.getElementById('submit-answer-btn');
  if (btn) btn.disabled = true;

  const timeSpent = Math.floor((Date.now() - state.questionStartTime) / 1000);

  // 收集答案
  let userAnswer = selectedAnswer || null;
  // 如果是填空
  const fillInputs = document.querySelectorAll('.fill-input');
  if (fillInputs.length > 0) {
    userAnswer = [...fillInputs].map(inp => inp.value.trim()).filter(v => v !== '');
    if (userAnswer.length === 0) userAnswer = null;
    else if (userAnswer.length === 1) userAnswer = userAnswer[0];
  }
  const singleFill = document.getElementById('fill-answer');
  if (singleFill) userAnswer = singleFill.value.trim() || null;

  // 获取当前 question_id
  try {
    const data = await api.getCurrentQuestion(examId);
    if (!data.question) { router.navigate(`/result/${examId}`); return; }
    const qid = data.question.id;
    const result = await api.submitAnswer(examId, qid, userAnswer, Math.max(1, timeSpent));

    // 显示反馈
    const feedbackClass = result.is_correct ? 'feedback-correct' : 'feedback-wrong';
    const correctAns = Array.isArray(result.correct_answer) ? result.correct_answer.join(', ') : result.correct_answer;
    document.getElementById('exam-content').innerHTML = `
      <div class="exam-question">
        <div class="feedback ${feedbackClass}">
          <h3>${result.is_correct ? '✓ 回答正确！' : '✗ 回答错误'}</h3>
          ${!result.is_correct ? `<p class="mb-1">正确答案: <strong>${escHtml(correctAns)}</strong></p>` : ''}
          ${result.analysis ? `<p class="mb-0 small mt-2">解析: ${escHtml(result.analysis)}</p>` : ''}
        </div>
        <button class="btn btn-primary btn-lg mt-3" onclick="goToNext()">${result.is_last ? '查看结果' : '下一题'}</button>
      </div>
    `;
    if (result.is_last) examId = null;
  } catch (err) {
    alert(err.message);
    document.getElementById('exam-content').innerHTML += '<p class="text-danger mt-2">提交失败，请重试</p>';
    if (btn) btn.disabled = false;
  }
}

function goToNext() {
  if (!examId) { router.navigate('/result/' + examId); return; }
  loadNextQuestion();
}

// 题库导入
let importFileData = null;

function showImportModal() {
  importFileData = null;
  document.getElementById('import-file').value = '';
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('import-btn').disabled = true;
  new bootstrap.Modal(document.getElementById('importModal')).show();
}

function previewImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      importFileData = JSON.parse(ev.target.result);
      document.getElementById('import-preview').innerHTML = `
        <div class="alert alert-info">
          <strong>${escHtml(importFileData.title)}</strong><br>
          ${importFileData.questions ? importFileData.questions.length : 0} 道题目
        </div>
      `;
      document.getElementById('import-btn').disabled = false;
    } catch {
      document.getElementById('import-preview').innerHTML = '<div class="alert alert-danger">无效的 JSON 文件</div>';
    }
  };
  reader.readAsText(file);
}

async function doImport() {
  if (!importFileData) return;
  const btn = document.getElementById('import-btn');
  btn.disabled = true; btn.innerHTML = '导入中...';
  try {
    await api.importBank(importFileData);
    bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
    router.navigate('/banks');
  } catch (err) {
    document.getElementById('import-preview').innerHTML = `<div class="alert alert-danger">导入失败: ${err.message}</div>`;
    btn.disabled = false; btn.innerHTML = '确认导入';
  }
}

function downloadSample() {
  const sample = {
    title: "示例题库",
    description: "这是一个示例题库",
    questions: [
      { type: "choice", chapter: "第一章 基础", content: "中国的首都是？", options: ["A. 上海", "B. 北京", "C. 广州", "D. 深圳"], answer: "B", analysis: "北京是中国的首都。" },
      { type: "fill", content: "中国的首都是____。", answer: "北京" },
      { type: "fill", content: "中国的四大发明是____、____、____和____。", answer: ["造纸术", "印刷术", "火药", "指南针"] },
      { type: "judge", content: "长江是中国最长的河流。", answer: "对" },
    ]
  };
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sample-question-bank.json';
  a.click();
}

function confirmDeleteBank(id, title) {
  if (!confirm(`确定删除题库「${title}」吗？该操作不可恢复。`)) return;
  api.deleteBank(id).then(() => router.navigate('/banks')).catch(err => alert(err.message));
}

// 初始化
async function init() {
  const authed = await checkAuth();
  if (!authed && !location.hash.match(/^\#\/(login|register)$/)) {
    router.navigate('/login');
  }
  router.resolve();
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 2: 创建 CSS**

```css
:root {
  --primary: #1E40AF;
  --primary-light: #3B82F6;
  --primary-dark: #1E3A8A;
  --success: #22C55E;
  --danger: #EF4444;
  --warning: #F59E0B;
  --bg-page: #EFF6FF;
  --bg-card: #FFFFFF;
  --text-primary: #1E3A8A;
  --text-muted: #64748B;
  --border: #CBD5E1;
}

body {
  font-family: 'Open Sans', sans-serif;
  background: var(--bg-page);
  color: var(--text-primary);
  min-height: 100vh;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Poppins', sans-serif;
}

.navbar {
  background: var(--primary) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.navbar-brand {
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 1.25rem;
}

.nav-link {
  color: rgba(255,255,255,0.85) !important;
  border-radius: 6px;
  padding: 0.5rem 0.75rem !important;
  transition: all 0.2s;
}

.nav-link:hover, .nav-link.active {
  color: #fff !important;
  background: rgba(255,255,255,0.15);
}

#content {
  padding-top: 80px;
  padding-bottom: 2rem;
  max-width: 960px;
  margin: 0 auto;
  min-height: 100vh;
}

.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
}

.auth-card {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;
}

.auth-logo {
  text-align: center;
  color: var(--primary);
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  border-radius: 8px;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--primary-dark);
  border-color: var(--primary-dark);
}

.card {
  border: none;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
  cursor: pointer;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}

.stat-card {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 1.25rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stat-number {
  font-family: 'Poppins', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.history-item {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateX(4px);
}

.empty-state {
  text-align: center;
  padding: 4rem 1rem;
}

/* Exam */
.exam-container {
  max-width: 720px;
  margin: 0 auto;
}

.exam-question {
  text-align: center;
  padding: 2rem 1rem;
}

.choice-option {
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  margin: 0.5rem 0;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.choice-option:hover {
  border-color: var(--primary-light);
  background: #EFF6FF;
}

.choice-option.selected {
  border-color: var(--primary);
  background: #DBEAFE;
  color: var(--primary-dark);
  font-weight: 600;
}

.exam-timer {
  font-family: 'Poppins', sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--primary);
  transition: color 0.3s;
}

.timer-warning {
  color: var(--warning) !important;
  animation: pulse 1s infinite;
}

.timer-danger {
  color: var(--danger) !important;
  animation: pulse 0.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.exam-progress {
  height: 8px;
  border-radius: 4px;
}

.progress-bar {
  background: var(--success);
  transition: width 0.3s ease;
}

.feedback {
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.feedback-correct {
  background: #F0FDF4;
  border: 2px solid var(--success);
}

.feedback-wrong {
  background: #FEF2F2;
  border: 2px solid var(--danger);
}

.answer-review-item {
  background: var(--bg-card);
  border-left: 4px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 0.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.answer-review-item.correct {
  border-left-color: var(--success);
}

.answer-review-item.wrong {
  border-left-color: var(--danger);
}

.result-title {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.result-score {
  font-family: 'Poppins', sans-serif;
  font-size: 4rem;
  font-weight: 700;
  color: var(--primary);
  line-height: 1;
  margin-bottom: 1.5rem;
}

.result-score small {
  font-size: 1.5rem;
}

/* Mode select cards */
.mode-card {
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  text-align: center;
  font-weight: 600;
}

.mode-card:hover {
  border-color: var(--primary-light);
}

.mode-card.active {
  border-color: var(--primary);
  background: #DBEAFE;
}

.bank-check-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.bank-check-card:hover {
  border-color: var(--primary-light);
  background: #EFF6FF;
}

.bank-check-card.selected {
  border-color: var(--primary);
  background: #DBEAFE;
}

.question-item {
  background: var(--bg-card);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 0.375rem;
  border-left: 3px solid var(--border);
}

.fill-input {
  text-align: center;
  font-size: 1.1rem;
}

.form-control:focus {
  border-color: var(--primary-light);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
}

@media (max-width: 576px) {
  #content {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  .stat-number {
    font-size: 1.5rem;
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add static/js/app.js static/css/style.css
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：前端 SPA 路由与样式"
```

---

### Task 8: 前端 HTML 入口

**Files:**
- Create: `static/index.html`

- [ ] **Step 1: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>刷题在线</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav id="navbar" class="navbar navbar-expand-lg navbar-dark fixed-top d-none">
    <div class="container">
      <a class="navbar-brand" href="#/dashboard">刷题在线</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navMenu">
        <ul class="navbar-nav me-auto">
          <li class="nav-item"><a class="nav-link" href="#/dashboard">仪表盘</a></li>
          <li class="nav-item"><a class="nav-link" href="#/banks">题库管理</a></li>
          <li class="nav-item"><a class="nav-link" href="#/exam/setup">答题</a></li>
          <li class="nav-item"><a class="nav-link" href="#/history">练习历史</a></li>
          <li class="nav-item"><a class="nav-link" href="#/wrong-answers">错题本</a></li>
        </ul>
        <ul class="navbar-nav">
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
              <i class="bi bi-person-circle"></i> <span id="nav-username"></span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" href="#" onclick="logout()">退出登录</a></li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </nav>

  <div id="content" class="container">
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="/js/api.js"></script>
  <script src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 验证项目结构**

Run: `ls -R static/`
Expected:
```
static/:
index.html  css/  js/
static/css:
style.css
static/js:
api.js  app.js
```

- [ ] **Step 3: 后端修正 — 确保返回的 answer 不暴露给选择型题目**

当前 `current_question` 路由中已屏蔽 `answer` 和 `analysis`，但需要确认。检查 `routers/exam.py` 中 `current_question` 函数是否设置 `q_out.answer = None` 和 `q_out.analysis = None`。已处理。

- [ ] **Step 4: 启动验证**

Run: `cd /home/Lsk/Documents/Code/Projects/刷题在线 && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &`
然后: `sleep 2 && curl -s http://localhost:8000/api/health`
Expected: `{"status":"ok"}`

终止测试进程: `kill %1`

- [ ] **Step 5: Commit**

```bash
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add static/index.html
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：前端 HTML 入口与集成"
```

---

### Task 9: 集成测试与修复

- [ ] **Step 1: 启动服务**

```bash
cd /home/Lsk/Documents/Code/Projects/刷题在线 && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
```

- [ ] **Step 2: 测试注册 → 登录 → 导入题库 → 答题 → 结果 → 历史的完整流程**

```bash
# 注册
curl -s -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"test","password":"123456"}' | python3 -m json.tool

# 保存 token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"test","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "TOKEN=$TOKEN"

# 导入题库
curl -s -X POST http://localhost:8000/api/question-banks/import \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "测试题库",
    "description": "这是一个测试",
    "questions": [
      {"type":"choice","content":"1+1=?","options":["A.1","B.2","C.3","D.4"],"answer":"B"},
      {"type":"fill","content":"中国的首都是____","answer":"北京"},
      {"type":"judge","content":"地球是圆的","answer":"对"}
    ]
  }' | python3 -m json.tool

# 开始答题
EXAM=$(curl -s -X POST http://localhost:8000/api/exam/start \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"bank_ids":[1],"mode":"random","types":["choice","fill","judge"],"choice_timeout":30,"judge_fill_timeout":60}')
echo "EXAM=$EXAM"
EXAM_ID=$(echo $EXAM | python3 -c "import sys,json; print(json.load(sys.stdin)['exam_id'])")

# 获取当前题目
curl -s http://localhost:8000/api/exam/$EXAM_ID/current \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 提交答案（假设是选择题 answer B）
QUESTION_ID=$(curl -s http://localhost:8000/api/exam/$EXAM_ID/current \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['question']['id'])")

curl -s -X POST http://localhost:8000/api/exam/$EXAM_ID/answer \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"exam_id\":$EXAM_ID,\"question_id\":$QUESTION_ID,\"user_answer\":\"B\",\"time_spent_seconds\":5}" | python3 -m json.tool

# 重复获取/提交直到完成...
# 获取结果
curl -s http://localhost:8000/api/exam/$EXAM_ID/result \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 仪表盘
curl -s http://localhost:8000/api/dashboard \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 历史
curl -s http://localhost:8000/api/history \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

- [ ] **Step 3: 修复任何发现的 bug**

Expected: 所有 API 返回正确的 JSON，无 500 错误

- [ ] **Step 4: 终止测试服务并提交**

```bash
kill %1 2>/dev/null
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" add -A
git -c user.name="opencode-agent" -c user.email="opencode@agent.local" commit -m "01实现：集成测试与修复"
```
