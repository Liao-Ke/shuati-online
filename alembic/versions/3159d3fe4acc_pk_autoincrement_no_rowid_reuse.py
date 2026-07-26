"""questions/question_banks 主键改 AUTOINCREMENT，根除 rowid 复用

Revision ID: 3159d3fe4acc
Revises: afa1757b2ecd
Create Date: 2026-07-26 21:29:42.004965

SQLite 的 INTEGER PRIMARY KEY（rowid 别名）会复用已删除行的 id：删除最高位行后，
下一次插入拿到同一个 id。「考试快照 / 答题记录里存的 id」因此可能重新指向他人
（或另一道）题目，这是 issue #84/#123/#125 一整类跨用户缺口的共同根因（issue #131）。

本迁移重建 questions / question_banks 两表加 AUTOINCREMENT（SQLite 不支持
ALTER COLUMN，由 batch 模式反射现有列/索引/外键后整表重建搬迁数据），并把
sqlite_sequence 过种子到「历史上被引用过的最大 id」——包括迁移前已被删除、
但仍留在答题记录和考试快照里的高位 id，否则这些 id 仍会被复用一次。

其余四张表保持普通 rowid 主键：它们的 id 不被任何快照、外键或接口响应存储，
即便复用也无从被旧引用指向（review_records 有级联删除路径、id 确实会复用，
但没有任何地方保存它）。
"""
import json
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3159d3fe4acc"
down_revision: str | None = "afa1757b2ecd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 过种子的候选 id 允许高出可信最大 id 的幅度。考试快照 bank_ids 存的是客户端原样
# 提交的整数列表（routers/exam.py start_exam，issue #125），把它直接当序列种子会让
# 任意用户提交 [2**63-1] 顶爆序列，升级后全站建库报 SQLITE_FULL。真实「已删除的
# 高位 id」与当前 max(id) 的差距只有删除行数量级，一百万足够宽松；
# ponytail: 固定常数而非精确推算历史分配上界——多顶高一百万 id 无任何副作用
# （id 仍单调不复用，距 SQLite 上限 2**63 极远），换掉了整段不确定的推算逻辑
SEED_MAX_GAP = 1_000_000

# batch 模式建的临时表在隐式事务开启前已 autocommit，迁移中途失败（磁盘满、OOM、
# 断电）时它不随事务回滚，残留后每次重试都报 table already exists——Docker 的
# `alembic upgrade head && uvicorn` 会因此陷入需人工 DROP 才能恢复的 crash-loop
_TMP_TABLES = ("_alembic_tmp_question_banks", "_alembic_tmp_questions")


def _max_json_ids(rows, limit: int) -> int:
    """JSON 数组文本列（考试快照 bank_ids/question_ids）里出现过的最大 id。
    超过 limit 的值视为脏数据丢弃——该列可被客户端投毒，见 SEED_MAX_GAP"""
    result = 0
    for (raw,) in rows:
        if not raw:
            continue
        try:
            ids = json.loads(raw)
        except (TypeError, ValueError):
            continue
        if isinstance(ids, list):
            result = max([result, *(i for i in ids if isinstance(i, int) and i <= limit)])
    return result


def _drop_stale_tmp_tables() -> None:
    for name in _TMP_TABLES:
        op.execute(f"DROP TABLE IF EXISTS {name}")


def _seed_sqlite_sequence(conn, name: str, seq: int) -> None:
    """sqlite_sequence 无主键不支持 UPSERT，手动 update-or-insert"""
    updated = conn.exec_driver_sql(
        "UPDATE sqlite_sequence SET seq = ? WHERE name = ?", (seq, name)
    )
    if updated.rowcount == 0:
        conn.exec_driver_sql(
            "INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)", (name, seq)
        )


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "sqlite":
        # 其他数据库的自增序列本就单调不复用，无需处理
        return

    def scalar(sql: str) -> int:
        return conn.exec_driver_sql(sql).scalar() or 0

    _drop_stale_tmp_tables()

    # 先重建父表再重建子表；alembic 连接未开 PRAGMA foreign_keys，重建期间
    # drop+rename 不会触发外键报错（应用 engine 的 FK 强制见 database.py）
    for table in ("question_banks", "questions"):
        with op.batch_alter_table(
            table, recreate="always", table_kwargs={"sqlite_autoincrement": True}
        ):
            pass

    # 数据搬迁已把 sqlite_sequence 顶到当前 max(id)，再过种子到历史引用过的最大 id。
    # 外键列与 question_ids 快照都由服务端写入（归属校验后），可信；bank_ids 快照
    # 是客户端输入，按 SEED_MAX_GAP 钳制
    max_question = max(
        scalar("SELECT max(id) FROM questions"),
        scalar("SELECT max(question_id) FROM answer_records"),
        scalar("SELECT max(question_id) FROM review_records"),
    )
    max_question = max(
        max_question,
        _max_json_ids(
            conn.exec_driver_sql("SELECT question_ids FROM exam_records"),
            max_question + SEED_MAX_GAP,
        ),
    )
    max_bank = max(
        scalar("SELECT max(id) FROM question_banks"),
        scalar("SELECT max(bank_id) FROM questions"),
    )
    max_bank = max(
        max_bank,
        _max_json_ids(
            conn.exec_driver_sql("SELECT bank_ids FROM exam_records"),
            max_bank + SEED_MAX_GAP,
        ),
    )
    if max_question:
        _seed_sqlite_sequence(conn, "questions", max_question)
    if max_bank:
        _seed_sqlite_sequence(conn, "question_banks", max_bank)


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "sqlite":
        return
    _drop_stale_tmp_tables()
    for table in ("questions", "question_banks"):
        with op.batch_alter_table(
            table, recreate="always", table_kwargs={"sqlite_autoincrement": False}
        ):
            pass
    conn.exec_driver_sql(
        "DELETE FROM sqlite_sequence WHERE name IN ('questions', 'question_banks')"
    )
