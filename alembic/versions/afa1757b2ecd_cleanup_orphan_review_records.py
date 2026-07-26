"""cleanup orphan review records

Revision ID: afa1757b2ecd
Revises: 519b18b6e049
Create Date: 2026-07-26 14:55:19.580649

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "afa1757b2ecd"
down_revision: str | None = "519b18b6e049"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """清理题目删除后残留的孤儿背题记录（issue #84）。

    题目删除原本不级联删除 review_records。SQLite 的 INTEGER PRIMARY KEY 会复用
    已删除行的 id，残留记录因此会被后来新增的题目继承，表现为从未标记过的新题目
    直接显示「已掌握」，统计也随之偏高。
    """
    op.execute("DELETE FROM review_records WHERE question_id NOT IN (SELECT id FROM questions)")


def downgrade() -> None:
    # 孤儿记录已物理删除且无备份，无法回滚
    pass
