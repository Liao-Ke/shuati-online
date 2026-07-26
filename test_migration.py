"""迁移 3159d3fe4acc 的回归测试（issue #131）。

集成测试的库由 `Base.metadata.create_all()` 建出，从不执行 alembic，因此迁移
逻辑——尤其是安全关键的 sqlite_sequence 过种子——在集成测试里零覆盖：即便
upgrade() 整个失效，集成测试照样全绿。本文件在临时库上真正跑一遍 alembic。
"""
import json
import os
import sqlite3
import subprocess
import sys

import pytest

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
PREV_REVISION = "afa1757b2ecd"


def _alembic(db_path: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=PROJECT_ROOT,
        env={**os.environ, "DATABASE_URL": f"sqlite:///{db_path}"},
        capture_output=True, text=True, check=True,
    )


def _ddl(db: sqlite3.Connection, table: str) -> str:
    return db.execute("SELECT sql FROM sqlite_master WHERE name=?", (table,)).fetchone()[0]


def _seq(db: sqlite3.Connection, table: str) -> int | None:
    row = db.execute("SELECT seq FROM sqlite_sequence WHERE name=?", (table,)).fetchone()
    return row[0] if row else None


@pytest.fixture
def db_path(tmp_path):
    """升级到本迁移的前一版，留给用例填充存量数据"""
    path = str(tmp_path / "migrate.db")
    _alembic(path, "upgrade", PREV_REVISION)
    return path


def _seed_baseline(db: sqlite3.Connection) -> None:
    db.execute("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')")
    db.execute("INSERT INTO question_banks (id, user_id, title) VALUES (10, 1, '库')")
    db.execute(
        "INSERT INTO questions (id, bank_id, type, content, answer, sort_order)"
        " VALUES (100, 10, 'judge', '题', '对', 0)"
    )


def test_upgrade_adds_autoincrement_and_preserves_data(db_path):
    """重建两表后 DDL 带 AUTOINCREMENT，数据、索引、外键完整性不变"""
    db = sqlite3.connect(db_path)
    _seed_baseline(db)
    db.commit()
    before = db.execute("SELECT id, bank_id, content FROM questions").fetchall()
    db.close()

    _alembic(db_path, "upgrade", "head")

    db = sqlite3.connect(db_path)
    assert "AUTOINCREMENT" in _ddl(db, "questions")
    assert "AUTOINCREMENT" in _ddl(db, "question_banks")
    assert db.execute("SELECT id, bank_id, content FROM questions").fetchall() == before
    assert db.execute(
        "SELECT count(*) FROM sqlite_master WHERE type='index' AND name IN"
        " ('ix_questions_id', 'ix_question_banks_id')"
    ).fetchone()[0] == 2
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    # 其余四张表保持普通 rowid 主键
    for table in ("users", "exam_records", "answer_records", "review_records"):
        assert "AUTOINCREMENT" not in _ddl(db, table)
    db.close()


def test_seed_covers_deleted_ids_only_referenced_by_snapshots(db_path):
    """迁移前已删除、只剩在答题记录/快照里的高位 id 不得被复用——过种子的核心目的"""
    db = sqlite3.connect(db_path)
    _seed_baseline(db)
    # id 200/300 的题目与 id 20 的题库均已删除，只剩引用
    db.execute(
        "INSERT INTO exam_records (id, user_id, bank_ids, mode, question_ids, status)"
        " VALUES (1, 1, ?, 'sequential', ?, 'completed')",
        (json.dumps([10, 20]), json.dumps([100, 300])),
    )
    db.execute(
        "INSERT INTO answer_records (id, exam_id, question_id, user_answer, is_correct)"
        " VALUES (1, 1, 200, 'A', 0)"
    )
    db.commit()
    db.close()

    _alembic(db_path, "upgrade", "head")

    db = sqlite3.connect(db_path)
    assert _seq(db, "questions") == 300, "种子未覆盖只存在于快照里的已删除题目 id"
    assert _seq(db, "question_banks") == 20, "种子未覆盖只存在于快照里的已删除题库 id"
    new_qid = db.execute(
        "INSERT INTO questions (bank_id, type, content, answer, sort_order)"
        " VALUES (10, 'judge', '新题', '对', 0)"
    ).lastrowid
    new_bank = db.execute(
        "INSERT INTO question_banks (user_id, title) VALUES (1, '新库')"
    ).lastrowid
    assert new_qid == 301, f"新题目 id 落在历史引用区间内：{new_qid}"
    assert new_bank == 21, f"新题库 id 落在历史引用区间内：{new_bank}"
    db.close()


def test_seed_rejects_client_poisoned_bank_ids(db_path):
    """exam_records.bank_ids 存的是客户端原样提交的整数列表（issue #125），
    不得被当作序列种子——否则一次请求即可顶爆序列，升级后全站建库 SQLITE_FULL"""
    db = sqlite3.connect(db_path)
    _seed_baseline(db)
    db.execute(
        "INSERT INTO exam_records (id, user_id, bank_ids, mode, status)"
        " VALUES (1, 1, ?, 'sequential', 'completed')",
        (json.dumps([10, 2**63 - 1]),),
    )
    db.commit()
    db.close()

    _alembic(db_path, "upgrade", "head")

    db = sqlite3.connect(db_path)
    assert _seq(db, "question_banks") == 10, "投毒值被当成了序列种子"
    # 序列未耗尽，建库仍然可用
    assert db.execute("INSERT INTO question_banks (user_id, title) VALUES (1, '新库')").lastrowid == 11
    db.close()


def test_seed_tolerates_malformed_snapshots(db_path):
    """快照列是 Text，历史脏数据（非 JSON、非数组、非整数元素）不得让迁移崩溃"""
    db = sqlite3.connect(db_path)
    _seed_baseline(db)
    for i, (banks, questions) in enumerate([
        ("not json", None), ("{}", '"str"'), ("[]", "[]"), ('["a", null, 1.5]', "[true]"),
    ]):
        db.execute(
            "INSERT INTO exam_records (id, user_id, bank_ids, mode, question_ids, status)"
            " VALUES (?, 1, ?, 'sequential', ?, 'completed')",
            (i + 1, banks, questions),
        )
    db.commit()
    db.close()

    _alembic(db_path, "upgrade", "head")

    db = sqlite3.connect(db_path)
    assert _seq(db, "questions") == 100
    assert _seq(db, "question_banks") == 10
    db.close()


def test_upgrade_recovers_from_stale_tmp_table(db_path):
    """迁移中途失败会残留 batch 模式的 _alembic_tmp_* 表（不随事务回滚），
    重试必须自愈——否则 Docker 的 `alembic upgrade head && uvicorn` 陷入 crash-loop"""
    db = sqlite3.connect(db_path)
    _seed_baseline(db)
    db.execute("CREATE TABLE _alembic_tmp_questions (id INTEGER)")
    db.execute("CREATE TABLE _alembic_tmp_question_banks (id INTEGER)")
    db.commit()
    db.close()

    _alembic(db_path, "upgrade", "head")

    db = sqlite3.connect(db_path)
    assert "AUTOINCREMENT" in _ddl(db, "questions")
    assert db.execute(
        "SELECT count(*) FROM sqlite_master WHERE name LIKE '_alembic_tmp_%'"
    ).fetchone()[0] == 0
    db.close()


def test_downgrade_restores_schema_and_data(db_path):
    """回滚复原 DDL 与数据，并清掉序列行；再次升级幂等"""
    db = sqlite3.connect(db_path)
    _seed_baseline(db)
    db.commit()
    db.close()

    _alembic(db_path, "upgrade", "head")
    _alembic(db_path, "downgrade", "-1")

    db = sqlite3.connect(db_path)
    assert "AUTOINCREMENT" not in _ddl(db, "questions")
    assert "AUTOINCREMENT" not in _ddl(db, "question_banks")
    assert db.execute("SELECT count(*) FROM questions").fetchone()[0] == 1
    assert _seq(db, "questions") is None
    assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    db.close()

    _alembic(db_path, "upgrade", "head")
    db = sqlite3.connect(db_path)
    assert "AUTOINCREMENT" in _ddl(db, "questions")
    db.close()


def test_upgrade_on_empty_database(tmp_path):
    """全新空库从零升到 head：两表带 AUTOINCREMENT，无空表报错"""
    path = str(tmp_path / "fresh.db")
    _alembic(path, "upgrade", "head")

    db = sqlite3.connect(path)
    assert "AUTOINCREMENT" in _ddl(db, "questions")
    assert "AUTOINCREMENT" in _ddl(db, "question_banks")
    assert db.execute("INSERT INTO users (username, password_hash) VALUES ('u', 'x')").lastrowid == 1
    db.close()
