# 修复进行中考试引用的题目可被编辑（issue #90）

## 背景

`delete_question` 已检查进行中考试是否引用该题并返回 409 阻止删除（issue #19），但 `update_question` 没有同样保护。用户可以在考试进行中编辑该题答案/题干/选项，导致 `submit_answer` 按编辑后的新答案判分，考试结果被污染。

## 修改范围

- `routers/questions.py`：`update_question` 加载题目后、修改前，复用 `delete_question` 的进行中考试引用检查，命中时返回 409。
- `test_integration.py`：新增 `test_38c_edit_question_blocked_by_inprogress`，验证进行中考试引用的题目拒绝编辑（409），考试完成后可编辑（200）。

## 验证

- 本地执行 `pytest test_integration.py -v`，98 个测试全部通过。
- 未引入新依赖，未改动数据结构或前端。

## 已知限制

采用"禁止编辑"方案而非"考试题目快照"方案。快照方案能同时保护已完成历史详情（#81），但涉及更大的数据结构调整，超出本次 bug 修复范围。
