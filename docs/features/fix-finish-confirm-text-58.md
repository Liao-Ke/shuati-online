# 修复：提前结束确认文案与后端统计规则一致（#58）

## 背景

issue #58 报告前端 `finishExam` 确认对话框的文案与后端实际行为不一致。后端在 #22 修复后将未作答题计为 `wrong_count`，但前端文案仍然提示「未答的题目将不计入成绩」，造成用户预期偏差。

## 修改范围

仅修改 `static/js/app.js` 一行文案：

| 文件 | 行号（原） | 旧文案 | 新文案 |
|------|-----------|--------|--------|
| `static/js/app.js` | `finishExam` 函数内 | 未答的题目将不计入成绩 | 未答的题目将计为错误 |

## 验证

- `node --check static/js/app.js` 语法通过
- `pytest test_integration.py` 72 项全通过（后端行为由 `test_06a_finish_exam_unanswered_count` 覆盖）
- 前端文案为纯文本字符串替换，无逻辑变更，无 UI 布局影响
