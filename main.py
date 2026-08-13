import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import inspect
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from database import Base, engine
from logging_config import setup_logging
from routers import auth, banks, dashboard, exam, history, questions, review, wrong_answers
from routers.limiter import limiter

logger = setup_logging()


def _sync_schema_version(fresh_db: bool) -> None:
    """create_all 与 alembic 双轨的两个失败模式防护（issue #136）。

    - 全新库由 create_all 建出后立即 stamp 到 head：天生带版本号，之后跑
      `alembic upgrade head` 不再撞已存在的表（坑 a）。
    - 存量库版本落后或缺版本号时 logger.error 显式告警：安全修复（如 #131
      主键 AUTOINCREMENT）在未迁移的库上不生效，失效不允许是静默的（坑 b）。

    不经由 alembic command API / env.py（其 fileConfig 会重配应用日志），
    直接用 MigrationContext 读写 alembic_version。
    """
    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    project_dir = os.path.dirname(os.path.abspath(__file__))
    cfg = Config(os.path.join(project_dir, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(project_dir, "alembic"))
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        current = ctx.get_current_revision()
        if current == head:
            return
        if current is None and fresh_db:
            ctx.stamp(script, head)
            logger.info(f"create_all 建出全新库，已 stamp 到迁移版本 {head}")
        elif current is None:
            logger.error(
                "数据库已有表但没有 alembic 版本号：请核对 schema 后执行 alembic stamp head"
                "（直接 upgrade 会因表已存在而失败）"
            )
        else:
            logger.error(
                f"数据库 schema 版本落后：当前 {current} / 期望 {head}，请执行 alembic upgrade head。"
                "未迁移的库上安全修复（如 #131 主键 AUTOINCREMENT）不生效。"
            )


_fresh_db = not inspect(engine).has_table("users")
Base.metadata.create_all(bind=engine)
logger.warning("使用 Base.metadata.create_all 建表，仅适用于开发环境。生产环境请确保通过 alembic upgrade head 管理 schema 版本。")
_sync_schema_version(_fresh_db)

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
