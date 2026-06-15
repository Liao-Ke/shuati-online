## 1. Frontend Fix

- [x] 1.1 In `loadQuestionByIndex()` 已作答分支，解析 `q.options` JSON 字符串构建选项 HTML，插入反馈块之前
- [x] 1.2 选项渲染带标签（A./B./C.）和文本，根据正误添加 `.option-correct` / `.option-wrong` class

## 2. 验证

- [x] 2.1 手动验证：在浏览器中进入单题模式，作答选择题后确认选项标签和内容同时显示，正误高亮正确
- [x] 2.2 手动验证：填空题、判断题的已作答显示不受影响
