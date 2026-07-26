# 修复：回看已作答题目数组答案不再显示为 Python repr（issue #111）

## 问题

单题模式回看已作答的多选/多空填空题时，`GET /api/exam/{id}/current?index=N` 对 `user_answer` / `correct_answer` 使用 Python `str()` 序列化，列表答案变成 repr 字符串（如 `"['A', 'B']"`）。前端直接渲染该字符串，「你的答案/正确答案」显示为 `['A', 'B']`，与结果页/历史详情（真实 JSON 数组 + `join(', ')`）格式不一致。前端 `parseAnswerArray` 靠「单引号替换为双引号再 JSON.parse」解析 repr 做选项高亮，答案文本含英文单引号（如 `don't`）时解析失败。

## 方案

后端返回真实类型，与结果页/历史详情接口口径统一：

- `schemas.py`：`ExamCurrent.user_answer` / `correct_answer` 放宽为 `str | list[str] | None`。
- `routers/exam.py` `current_question`：去掉 `str()` 转换，直接返回 `parse_json_field` / `parse_answer` 的结果。
- `static/js/app.js`：
  - `parseAnswerArray` 直接透传数组，删除 repr 解析分支（顺带消除单引号答案文本的解析隐患）；
  - 新增 `formatAnswerText`，数组答案渲染为 `A, B` 可读格式，两处文案接入。

选项高亮逻辑不变（`parseAnswerArray` 输出仍是字母数组）。选择题/判断题/单空填空仍返回字符串，行为不变。

## 验证

- `pytest test_integration.py`：127 通过，新增 `test_111a`（多选题回看返回 JSON 数组）、`test_111b`（选择题仍返回字符串）。
- `node --test tests/frontend/*.test.js`：20 通过，新增 `answered_answer_display.test.js` 覆盖数组透传、字符串包装、单引号文本、可读格式渲染。
- `ruff check .` 通过。

## 已知限制

- 无。接口消费方仅 `loadQuestionByIndex` 已作答分支，已同步适配。
