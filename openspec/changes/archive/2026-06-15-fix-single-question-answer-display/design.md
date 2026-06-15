## Context

单题模式下，用户作答选择题后，`loadQuestionByIndex()` 在 `data.is_answered === true` 分支中仅渲染了正误反馈和答案文本，省略了选项内容。用户看不到自己选的选项的具体文字。

后端在 `data.question.options` 中已正确返回选项 JSON 字符串（`["选项A", "选项B", ...]`），前端只需在已作答分支中读取并渲染即可。

## Goals / Non-Goals

**Goals:**
- 已作答选择题在单题模式下显示选项标签（A./B./C.）和对应的选项文本
- 已作答选项标记正确/错误状态（绿色正确 / 红色错误，与结果页 `renderOptions()` 风格一致）

**Non-Goals:**
- 不改变未作答时的交互方式（点击选择、提交等）
- 不修改后端 API 响应结构
- 不改动整卷模式、结果页、历史页等其他页面的渲染
- 不引入新的 CSS 或样式（复现有样式）

## Decisions

1. **在已作答分支内联构建选项 HTML**，而非复用 `renderOptions()`
   - `renderOptions()` 用于结果页/历史页，接收的是已解析的 options 数组；但单题模式下 `q.options` 是 JSON 字符串，需先 `JSON.parse`
   - 内联方式避免了函数签名适配，改动集中、风险低
   - 选项 HTML 结构复用已有 `.choice-option` class，使样式与未作答状态保持一致

2. **使用 `.option-correct` / `.option-wrong` class 标记正误**
   - 与结果页 `renderOptions()` 一致的 class 命名，保持视觉一致性
   - 已存在的 CSS 规则直接生效，无需新增样式

3. **不修改后端**
   - 后端已返回完整选项数据，前端渲染是唯一缺口

## Risks / Trade-offs

- 无显著风险。改动局限于 `loadQuestionByIndex()` 的一个分支，属于纯 UI 渲染修复
- 若后续修改选项渲染逻辑，需同步更新已作答和未作答两处代码（预计可通过抽取 `renderOptionsInExam()` 统一，但当前不引入以控制改动范围）
