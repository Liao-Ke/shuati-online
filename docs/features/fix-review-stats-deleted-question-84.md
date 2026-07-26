# 修复背题统计计入已删除题目（issue #84）

## 背景

`ReviewRecord` 按 `user_id + question_id` 保存背题掌握状态，但删除题目/题库时并不清理它，`/api/review/stats` 又直接按 `review_records` 计数，导致「已掌握 / 待复习」数量继续包含已删除题目。

孤儿记录的危害不止于统计偏高。SQLite 的 `INTEGER PRIMARY KEY` 没有 `AUTOINCREMENT`，新行取 `max(rowid) + 1`，**删除最大 id 的题目后新增题目会复用该 id**（生产部署默认即 SQLite）。残留记录随即被这道全新题目继承：

```
旧题 id=1 标记「已掌握」→ 删除 → 新增一道全新题目，id 复用为 1
→ 背题列表显示该题 review_status="known"，统计凭空 +1
```

因此只在查询期 JOIN 过滤是不够的——id 复用后题目确实存在，过滤条件拦不住。

## 修改范围

- `models.py`：`Question.review_records` 加 `cascade="all, delete-orphan"`，删除题目时级联删除背题记录；删除题库经由 `QuestionBank.questions` 逐级触发。
- `alembic/versions/afa1757b2ecd_cleanup_orphan_review_records.py`：新增迁移，一次性清理存量孤儿记录（`DELETE FROM review_records WHERE question_id NOT IN (SELECT id FROM questions)`）。
- `routers/review.py`：`_count_existing_review_records()` 统一 `/stats` 与 `/mark` 的统计口径，JOIN `Question` / `QuestionBank` 只计入当前用户仍存在的题目。级联生效后此过滤在正常路径上已是冗余，保留作为兜底（未执行迁移的旧库、手工改库）。
- `test_integration.py`：
  - `test_25a_review_stats_ignore_deleted_questions` — 删除单题、删除题库后统计回落。
  - `test_25b_review_record_not_inherited_by_reused_id` — 删除后新增题目（可能复用 id），断言 `review_status` 为 `null` 且统计不变。
- 文档同步：`docs/api/endpoints.md`（两个 DELETE 接口的级联说明、`/api/review/stats` 口径）、`docs/arch/system.md`（stats 流程）、`docs/db/schema.md`（新增「题目删除时关联记录的两种策略」）。

## 关键决策

`answer_records` 与 `review_records` 对题目删除采用相反策略：前者 `question_id` 置空保留（历史答卷需留痕），后者级联删除（「当前掌握状态」在题目不存在时无意义）。详见 `docs/db/schema.md`。

## 验证

- `python -m ruff check .` 通过。
- `pytest test_integration.py -q`：125 个测试全部通过。
- 反向验证：临时回退 `models.py` 的级联后 `test_25b` 失败，确认该用例真实覆盖了 id 复用路径。
- 迁移验证：临时库中插入孤儿记录，`alembic upgrade head` 后孤儿被清理、有效记录保留；`downgrade` / `upgrade` 可重复执行。

## 已知限制

- 清理迁移不可回滚（孤儿记录物理删除且无备份），`downgrade` 为空实现。
- 级联在 ORM 层实现，绕过应用直接写库（如手工 `DELETE FROM questions`）仍会产生孤儿。数据库层 `ON DELETE CASCADE` 需要 SQLite 开启 `PRAGMA foreign_keys=ON`，属于全局外键行为变更，超出本次修复范围。
- 背题状态不做归档。若后续需要「已删除题目的历史掌握记录」，应单独设计归档表与展示入口，而不是靠孤儿记录兜着。
