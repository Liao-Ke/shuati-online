# 修复：切换答题模式不再清掉计时方式选择（issue #152）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #152（#4/#35 选择器作用域污染的残留点）

## 问题

答题设置页「答题模式」与「计时方式」两组卡片同用 `.mode-card` 类。
`selectTimerMode` 已用 `[data-timer]` 限定作用域，但 `selectMode` 仍按类名
全清 active——用户先选「整卷计时」再点任一答题模式，计时卡片高亮全部被清，
开考时 `[data-timer].active` 为 null 静默回退 `per_question`，整卷计时被丢弃，
且设置页无任何可见线索。

## 修复

一行对齐：`selectMode` 的清除范围从 `.mode-card` 改为 `[data-mode]`
（与 `selectTimerMode` 同口径）。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 38 pass（新增 1 项）
```

新增 `tests/frontend/mode_card_scope.test.js`：已选整卷计时后点答题模式卡，
断言答题模式组内正常切换、整卷计时 active 保留。已红-绿验证：旧代码下失败。

## 已知限制

- 无。
