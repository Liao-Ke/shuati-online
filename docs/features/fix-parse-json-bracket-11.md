# 修复 parse_json_field 将以 [ 开头的字符串误判为 JSON 数组

**日期：** 2026-07-03  &emsp; **关联 Issue：** [#11](https://github.com/Liao-Ke/shuati-online/issues/11)

## 目标

填空题答案以 `[` 开头时（如 `[H⁺]`、`[Fe(CN)₆]⁴⁻`），`parse_json_field` 会尝试 `json.loads` 解析，导致解析失败或误判为列表。

## 修改范围

- `utils.py`：新增 `parse_answer(answer, question_type)` 函数，根据题型决定是否尝试 JSON 解析
- `routers/exam.py`：`submit_answer`、`current_question`、`exam_preview`、`exam_result` 中对 `question.answer` 的解析改用 `parse_answer`
- `routers/wrong_answers.py`：`list_wrong` 中对 `q.answer` 的解析改用 `parse_answer`
- `routers/banks.py`：`export_bank` 中内联的 `startswith("[")` 逻辑替换为 `parse_answer`
- `routers/questions.py`：`update_question` 中内联的 `startswith("[")` 逻辑替换为 `parse_answer`
- `test_integration.py`：新增 4 个测试用例覆盖括号答案场景

## 核心实现

`parse_answer` 的逻辑：
1. `choice` / `judge` 题型：答案一定是纯字符串，直接返回原值
2. `fill` / `multiple` 题型：尝试 `json.loads`，仅当解析成功且结果为 `list` 时返回列表，否则返回原始字符串

这样 `[H⁺]` 这类非法 JSON 会 fallback 返回原字符串，而 `["1","2"]` 这类合法 JSON 数组仍被正确解析为列表。

`parse_json_field` 保留不动，继续用于 `options`、`bank_ids`、`question_ids`、`user_answer` 等存储格式确定为 JSON 的字段。

## 影响范围

- 所有涉及 `question.answer` 读取的路由
- 不影响 `options`、`bank_ids` 等字段的解析

## 验证方式

1. `ruff check .` 通过
2. 70 个集成测试全部通过，含 4 个新增的括号答案测试

## 已知限制

- 无
