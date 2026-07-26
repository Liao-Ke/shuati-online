# 修复：多空填空题未作答时按空位数量渲染输入框（issue #82）

## 问题

多空填空题的正确答案以数组保存。未作答时后端 `_serialize_question(hide_answer=True)` 将 `answer` 置为 `null`（防泄题），但前端单题模式与整卷预览都依赖 `q.answer` 判断空位数量——`answer` 为 `null` 时只渲染一个输入框。用户只能提交单字符串，后端按答案数组长度判分（长度不匹配即错），该题在 UI 上无法答对。

## 方案

后端返回安全元数据 `blank_count`（仅空位数量，不含答案内容）：

- `schemas.py`：`QuestionOut` 新增 `blank_count: int | None`（非填空题为 `null`）。
- `routers/exam.py`：新增 `_fill_blank_count()`（fill 题解析 answer，数组取长度、否则为 1），`_serialize_question` 与 `exam_preview` 两处输出。
- `static/js/app.js`：单题模式 `loadQuestionByIndex` 与整卷预览 `renderFullPreview` 的 fill 分支改用 `q.blank_count` 决定输入框数量，删除对 `q.answer` 的解析依赖；`blank_count` 缺省回退单输入框。

提交路径无需改动：两种模式的提交逻辑本就按输入框数量收集数组答案，输入框渲染正确后即可正常判分。

## 验证

- `pytest test_integration.py`：128 通过，新增 `test_82a`（/current 未答 fill 返回 blank_count 且 answer 隐藏）、`test_82b`（preview 同口径）、`test_82c`（非填空题为 null）。
- `node --test tests/frontend/*.test.js`：19 通过，新增 `fill_blank_count.test.js` 以 vm 加载 app.js 渲染验证：单题模式多空渲染 4 个输入框/单空单输入框、整卷预览多空渲染 4 个输入框/缺省回退单输入框。
- `ruff check .` 通过。

## 已知限制

- `blank_count` 会暴露多空题的空位数量。空位数通常可从题干占位符推断，不视为泄题。
