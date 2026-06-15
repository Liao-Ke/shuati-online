## Why

单题模式下作答选择题后，反馈页面只显示选项标签（A/B/C）但缺少选项具体内容，用户无法确认自己选了哪个选项的文字，体验不完整。

## What Changes

- 在 `loadQuestionByIndex()` 的已作答分支中，在反馈块上方渲染选项内容（带标签 A./B./C. 和对应文本）
- 已作答的选项应高亮正确/错误状态（与结果页 `renderOptions()` 风格一致）

## Capabilities

### New Capabilities
- `single-question-answer-display`: 单题模式下已作答选择题的选项内容显示，包含选项标签、选项文本和正误高亮

### Modified Capabilities
- （无）

## Impact

- `static/js/app.js`：`loadQuestionByIndex()` 函数的已作答渲染分支
- 无后端改动，无 API 变更
