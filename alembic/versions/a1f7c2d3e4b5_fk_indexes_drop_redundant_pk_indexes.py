"""外键列补索引，删除主键 id 上的冗余索引

Revision ID: a1f7c2d3e4b5
Revises: 3159d3fe4acc
Create Date: 2026-07-27 08:30:00.000000

索引配置整体反了（issue #137）：6 个 index=True 全部加在 id 主键上——SQLite 的
INTEGER PRIMARY KEY 即 rowid 别名，这些二级索引永远不会被查询计划选中，纯属
写放大；而真正参与 join/filter 的 6 个外键列一个索引都没有，热点查询
（按题库列题、按考试取答题记录、提交答案定位单题、历史列表等）全表扫。
docs/db/schema.md 声称的外键索引由本迁移落地为真。

review_records.user_id 不单独加：已被联合唯一约束 uq_user_question_review
的前导列覆盖。username 唯一索引保留不动。
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1f7c2d3e4b5"
down_revision: str | None = "3159d3fe4acc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (索引名, 表, 列)——索引名与 models.py 的 index=True 命名约定 ix_<表>_<列> 一致，
# 保证 create_all 建的新库与迁移升级的旧库索引集合相同
FK_INDEXES = [
    ("ix_question_banks_user_id", "question_banks", "user_id"),
    ("ix_questions_bank_id", "questions", "bank_id"),
    ("ix_exam_records_user_id", "exam_records", "user_id"),
    ("ix_answer_records_exam_id", "answer_records", "exam_id"),
    ("ix_answer_records_question_id", "answer_records", "question_id"),
    ("ix_review_records_question_id", "review_records", "question_id"),
]

REDUNDANT_PK_INDEXES = [
    ("ix_users_id", "users"),
    ("ix_question_banks_id", "question_banks"),
    ("ix_questions_id", "questions"),
    ("ix_exam_records_id", "exam_records"),
    ("ix_answer_records_id", "answer_records"),
    ("ix_review_records_id", "review_records"),
]


def upgrade() -> None:
    for name, table, column in FK_INDEXES:
        op.create_index(name, table, [column])
    for name, table in REDUNDANT_PK_INDEXES:
        op.drop_index(name, table_name=table)


def downgrade() -> None:
    for name, table in REDUNDANT_PK_INDEXES:
        op.create_index(name, table, ["id"])
    for name, table, _ in FK_INDEXES:
        op.drop_index(name, table_name=table)
