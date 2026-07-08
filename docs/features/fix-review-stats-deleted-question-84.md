# 修复背题统计计入已删除题目（#84）

## 问题

`ReviewRecord` 记录按 `user_id + question_id` 保存背题状态。删除题目或题库后，历史 `ReviewRecord` 可能仍留在数据库中，`/api/review/stats` 直接按 `review_records` 计数，导致“已掌握/待复习”数量继续包含已删除题目。

## 修复

- 背题统计改为只统计当前用户仍存在的题目：`ReviewRecord` 计数时 join `Question` 和 `QuestionBank`。
- `/api/review/mark` 返回的统计值复用同一口径，避免标记题目后返回被孤儿记录污染的数量。
- 不物理清理既有孤儿记录，避免误删未来可能需要归档的历史标记；本次仅明确当前统计口径。

## 验证

- 新增集成测试 `test_25a_review_stats_ignore_deleted_questions`，覆盖删除单题和删除题库后统计回落。

## 已知限制

- 数据库中既有孤儿 `ReviewRecord` 暂不迁移、不删除；如后续需要历史归档，应单独设计归档语义与展示入口。
