import os
import logging

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from database import engine, Base
from logging_config import setup_logging
from routers import auth, banks, exam, history, dashboard, wrong_answers, review, questions
from routers.limiter import limiter

Base.metadata.create_all(bind=engine)

app = FastAPI(title="刷题在线", version="1.0.0")

logger = setup_logging()
logger.info("服务启动")

cors_origins = os.getenv("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins.split(",") if cors_origins != "*" else ["*"],
    allow_credentials=True,
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
