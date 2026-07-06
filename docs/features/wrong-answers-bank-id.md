# 错题本按题库 ID 区分来源

**日期：** 2026-07-06  &emsp; **关联 Issue：** #54

## 目标
错题本列表和错题练习弹窗原先用 `bank_title` 识别题库来源，同名题库会被混分组并误勾选。改为使用 `bank_id` 作为唯一身份标识。

## 修改范围

### 后端
- `routers/wrong_answers.py` — `GET /api/wrong-answers` 响应新增 `bank_id` 字段

### 前端
- `static/js/app.js`
  - 错题本列表分组 key 从 `bank_title` 改为 `bank_id`，标题旁追加题库 ID，便于区分同名题库
  - 错题练习弹窗默认勾选从 `wrongBankTitles.has(b.title)` 改为 `wrongBankIds.has(b.id)`，并在题库名称旁显示 ID

### 测试
- `test_integration.py` — `test_07_wrong_answers` 增加 `bank_id` 字段断言；新增 `test_07f` 验证同名题库通过 `bank_id` 区分
- `tests/frontend/exam_timeouts.test.js` — 覆盖同名题库显示名包含 ID，且错题练习默认勾选按 `bank_id` 判断

## 根因
`QuestionBank.title` 无唯一约束，同用户可创建多个同名题库。后端 `POST /api/wrong-answers/start` 已按 `bank_id` 过滤，但 `GET /api/wrong-answers` 只返回 `bank_title`，前端被迫用标题做身份，导致同名题库误分组。

## 验证
- `pytest test_integration.py` — 98 passed
- `node --test tests/frontend/*.test.js` — 覆盖前端同名题库显示和默认勾选逻辑
