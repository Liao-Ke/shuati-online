# 修复单题模式已作答选择题选项显示

## 目标

单题模式下作答选择题后，反馈页面只显示选项标签（A/B/C）但缺少选项具体内容，用户无法确认自己选了哪个选项的文字。

## 修改范围

- `static/js/app.js`：`loadQuestionByIndex()` 函数的已作答渲染分支
- `openspec/specs/single-question-answer-display/spec.md`：新增主规约

## 核心实现

在 `loadQuestionByIndex()` 的 `data.is_answered === true` 分支中，对于 choice/multiple 题型：
1. 解析 `q.options` JSON 字符串构建选项 HTML
2. 新增 `parseAnswerArray()` 辅助函数，将 API 返回的字符串格式答案（如 `"['A','B']"`）解析为数组
3. 选项显示带标签（A./B./C.）和文本，根据正误添加 `.option-correct` / `.option-wrong` class
4. 选项 HTML 插入反馈块之前

## 影响范围

- 仅限单题模式已作答选择题的反馈显示
- 填空题、判断题不影响
- 整卷模式、结果页、历史页不受影响

## 验证方式

1. 48 个集成测试全部通过
2. 手动验证：选择题作答后显示选项内容，正误高亮正确
3. 手动验证：填空/判断题显示不受影响

## 已知限制

- 选项渲染逻辑与未作答状态和结果页各自独立，后续若有统一渲染需求可抽取公共函数
