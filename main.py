import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from database import Base, engine
from logging_config import setup_logging
from routers import auth, banks, dashboard, exam, history, questions, review, wrong_answers
from routers.limiter import limiter

logger = setup_logging()
Base.metadata.create_all(bind=engine)
logger.warning("使用 Base.metadata.create_all 建表，仅适用于开发环境。生产环境请确保通过 alembic upgrade head 管理 schema 版本。")

app = FastAPI(title="刷题在线", version="1.0.0")

logger.info("服务启动")

cors_origins = os.getenv("CORS_ORIGINS", "*")
is_wildcard = cors_origins == "*"
# CORS 规范禁止 Access-Control-Allow-Origin: * 与 credentials 同时使用，故通配时关闭 credentials。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else cors_origins.split(","),
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

allowed_hosts = os.getenv("ALLOWED_HOSTS", "*")
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=allowed_hosts.split(",") if allowed_hosts != "*" else ["*"],
)


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(banks.router)
app.include_router(exam.router)
app.include_router(history.router)
app.include_router(dashboard.router)
app.include_router(wrong_answers.router)
app.include_router(review.router)
app.include_router(questions.router)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
