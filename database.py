import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./exam.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _enforce_sqlite_foreign_keys(dbapi_connection, _connection_record):
        # SQLite 默认不强制外键，DDL 上的 FK 形同虚设：绕过 ORM 的原生 SQL 删除会留下
        # 悬垂引用，id 复用后即泄露（issue #131 纵深防御）。只挂在应用 engine 实例上，
        # alembic 迁移自建的连接不受影响——batch 整表重建需要外键保持关闭
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_write_db():
    db = SessionLocal()
    try:
        # SQLite 写事务（issue #132）：pysqlite 方言 do_begin 不发语句，事务靠驱动
        # 隐式 BEGIN，SELECT 实际在事务外执行（读快照与写入分离）——这是删除守卫
        # check-then-act 竞态的根源。此处显式 BEGIN IMMEDIATE：事务从第一条语句起
        # 持有写锁，串行化所有写者；sqlite3 检测 in_transaction 后不会重复隐式 BEGIN，
        # 提交/回滚仍由 Session 照常发出。
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        yield db
    finally:
        db.close()
