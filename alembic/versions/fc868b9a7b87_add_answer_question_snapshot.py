"""add answer question snapshot

Revision ID: fc868b9a7b87
Revises: afa1757b2ecd
Create Date: 2026-07-26 19:04:34.280275

"""
import json
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fc868b9a7b87"
down_revision: str | None = "afa1757b2ecd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _parse_options(options: str | None) -> list | None:
    """与 utils.parse_json_field 同逻辑：迁移需自包含，不 import 应用代码"""
    if not options:
        return None
    try:
        parsed = json.loads(options)
        return parsed if isinstance(parsed, list) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _parse_answer(answer: str | None, question_type: str) -> object:
    """与 utils.parse_answer 同逻辑"""
    if not answer or question_type in ("choice", "judge"):
        return answer
    try:
        parsed = json.loads(answer)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return answer


def upgrade() -> None:
    """answer_records 增加题目快照列，并回填题目尚存的存量记录（issue #81）。

    删除题库会级联删除题目，历史详情原本只按现存题目回填答案明细，
    题目删除后明细静默丢失。快照在作答时固化题目内容，使历史长期可读。
    已成孤儿（题目已删除）的旧记录无从回填，历史详情对其显示占位。
    """
    op.add_column("answer_records", sa.Column("question_snapshot", sa.Text(), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT a.id AS aid, q.type, q.chapter, q.content, q.options, q.answer, q.analysis "
        "FROM answer_records a JOIN questions q ON q.id = a.question_id "
        "WHERE a.question_snapshot IS NULL"
    )).mappings().all()
    params = [
        {
            "s": json.dumps({
                "type": r["type"], "chapter": r["chapter"], "content": r["content"],
                "options": _parse_options(r["options"]),
                "correct_answer": _parse_answer(r["answer"], r["type"]),
                "analysis": r["analysis"],
            }, ensure_ascii=False),
            "i": r["aid"],
        }
        for r in rows
    ]
    if params:
        conn.execute(sa.text("UPDATE answer_records SET question_snapshot = :s WHERE id = :i"), params)


def downgrade() -> None:
    op.drop_column("answer_records", "question_snapshot")
