# 修复题目增删改不更新题库 updated_at（issue #87）

## 背景

题库列表接口按 `QuestionBank.updated_at` 倒序返回。题目的新增、编辑、删除只操作 `questions` 表，未触碰所属 `question_banks` 行，导致维护题目后题库在列表中的排序不变。

## 修改范围

- `routers/questions.py`：
  - `create_question`：题目写入后，同步设置 `bank.updated_at = utcnow()`。
  - `update_question`：题目更新后，同步设置 `question.question_bank.updated_at = utcnow()`。
  - `delete_question`：题目删除前，同步设置 `question.question_bank.updated_at = utcnow()`。
- `test_integration.py`：
  - 新增 `test_29b_create_question_updates_bank_updated_at`
  - 新增 `test_36b_edit_question_updates_bank_updated_at`
  - 新增 `test_38b_delete_question_updates_bank_updated_at`
  分别验证增、改、删题目后题库 `updated_at` 刷新。

## 验证

- 本地执行 `pytest test_integration.py -v`，100 个测试全部通过。
- 手动验证：创建题库 → 新增/编辑/删除题目 → 题库详情 `updated_at` 变化，列表排序随之更新。

## 已知限制

无。未引入新依赖，未改动 `models.py` 或 `routers/banks.py` 的现有排序逻辑。
