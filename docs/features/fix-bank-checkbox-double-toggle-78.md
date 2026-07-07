# 修复题库卡片 checkbox 双重切换

**日期：** 2026-07-06  &emsp; **关联 Issue：** #78

## 目标
答题设置页和背题设置页点击题库卡片内 checkbox 时，避免浏览器原生切换与外层卡片 onclick 手动切换叠加，导致 checkbox 勾选状态、卡片 selected 样式、已选数量和提交的 `bank_ids` 不一致。

## 修改范围
- `static/js/app.js`
  - `toggleBankSelect(el, ev)` 和 `toggleReviewBankSelect(el, ev)` 接收事件对象。
  - 点击 checkbox 本身时不再手动反转，点击卡片空白区域时保持原有整卡可点行为。
  - `selected` 样式统一跟随 `cb.checked`，以 checkbox 作为事实来源。
- `tests/frontend/exam_timeouts.test.js`
  - 使用 Node 内置 `node:test` 补充前端回归测试，覆盖答题设置和背题设置中点击 checkbox、点击卡片空白区域后的 checked/selected 同步。

## 验证
- `node --check static/js/app.js`
- `node --test tests/frontend/*.test.js`
- `/home/Lsk/miniconda3/bin/python -m ruff check .`
