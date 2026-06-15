## Why

整卷计时模式（`elapsed`）当前未正确实现其 UI 描述的"记录总用时，不限时作答"功能。选择该模式后，系统仍在执行逐题倒计时，并在超时后自动提交，与"不限时"的设计意图相悖。用户期望的是：仅累计总用时，不对作答施加任何时间限制。

## What Changes

- **停用逐题倒计时**：`elapsed` 模式下不再为每题启动 `startTimer()` 倒计时，取消自动提交行为
- **总用时显示**：`#exam-timer` 在 `elapsed` 模式下改为显示从考试开始累计的总用时时长（取代 `#exam-elapsed` 作为辅助元素）
- **提交时间计算**：`elapsed` 模式下提交答案时，`time_spent_seconds` 使用从考试开始到提交时刻的累计耗时，而非单题耗时
- **暂停行为适配**：暂停期间总用时停止累积，恢复后续计

## Capabilities

### New Capabilities
- `exam-elapsed-timer`: 整卷计时的总用时时长累计与显示，无单题时间约束

### Modified Capabilities
- 无（本变更不修改已有的 spec 级别行为，仅修正 `elapsed` 模式实现与设计的一致性）

## Impact

- **`static/js/app.js`**：修改 `loadQuestionByIndex`、`startTimer`/`startElapsedTimer`、`submitCurrentAnswer`、`pauseExam`/`resumeExam`、`finishExam` 中的定时器逻辑
- **`routers/exam.py`**：后端无需修改 —— `duration_seconds` 已正确由 `submit_answer` 累计
- **`static/js/app.js`** 中的全局变量 `examTimerMode`、`examElapsedInterval`、`examStartedAt` 使用方式不变
- 不涉及数据库变更、模型变更或 schema 变更
