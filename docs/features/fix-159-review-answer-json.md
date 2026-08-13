# 修复：背题模式多选/多空答案不再显示 JSON 原文（issue #159）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #159（#111/#121 修复答题回看场景，本条是背题模式残留）

## 问题

背题模式题卡「答案」直接输出 DB 原文。`/api/review/questions` 的 `answer` 是
存储原文（多选/多空为 `json.dumps` 结果），页面显示 `["A", "B"]`、
`["造纸术", "印刷术"]`。同卡片的选项高亮早已 `JSON.parse(q.answer)`，
只有答案文本行漏转换；结果页口径是 `formatAnswerText` 的 `A, B`。

## 修复

`renderReviewPage` 答案行：尝试 `JSON.parse`，解析出数组则走 `formatAnswerText`
（`A, B` / `造纸术, 印刷术`）；choice/judge/单空 fill 不是 JSON，parse 抛错原样展示。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 40 pass（新增 3 项）
```

新增 `tests/frontend/review_answer_display.test.js`：多选 `["A","B"]` → `A, B`、
多空 → 逗号分隔、choice/judge/单空 fill 原样不受影响。
已红-绿验证：旧代码下前两项失败。测试 stub 实现了 escHtml 依赖的
textContent→innerHTML 转义语义。

## 已知限制

- 无。与结果页/回看页口径一致。
