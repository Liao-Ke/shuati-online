## Context

当前 `elapsed`（整卷计时）模式仅比 `per_question` 模式多隐藏了超时输入框，但其核心倒计时/自动提交逻辑完全一致。选择"整卷计时"的 user 预期是"不限时作答"，但实际上每题仍有倒计时并自动提交，导致体验错误。

## Goals / Non-Goals

**Goals:**
- `elapsed` 模式下每题不再显示倒计时，不再自动提交
- `elapsed` 模式下 `#exam-timer` 显示从上一次暂停结束到当前的累计用时（而非剩余时间）
- 暂停期间总用时暂停累积
- 提交时 `time_spent_seconds` 记录从考试开始（扣除暂停期间）到提交时刻的累计耗时

**Non-Goals:**
- 不修改后端 API 或数据模型
- 不修改 `per_question` 模式的行为
- 不修改 exam 设置页面的 UI

## Decisions

1. **复用 `#exam-timer` 而非 `#exam-elapsed`**
   - 理由：`#exam-elapsed` 始终在标题栏占位，当前显示 `总 MM:SS`；将其作为唯一计时显示，移除 `#exam-timer` 的倒计时逻辑，统一用累计时序更新。
   - 选型：在 `elapsed` 模式下，`#exam-timer` 显示累计总用时（与 `per_question` 模式共用同一 DOM 元素），`#exam-elapsed` 始终保持隐藏。`per_question` 模式下行为不变。

2. **累计时 `elapsedSeconds` 使用前端本地计算**
   - 理由：无需后端存储每题的实时时间戳。考试开始时记录 `examStartedAt`，暂停时记录 `pauseElapsed` 和 `pauseStartedAt`，恢复时更新偏移量。
   - 方案：维护 `examElapsedOffset`（已完成的累计秒数，包括暂停前的时间），每秒由 `examStartedAt` 计算增量。

3. **暂停期间总用时停止累积**
   - 理由：暂停的语义是"用户未在答题"，不应计入用时。
   - 实现：`pauseExam()` 记录当前累计值到 `examElapsedOffset`，`resumeExam()` 重置 `examStartedAt` 为当前时间。

4. **提交答案时 `time_spent_seconds` 使用从考试开始到提交时刻的累计耗时**
   - 理由：后端 `submit_answer` 在 `exam.duration_seconds = (exam.duration_seconds or 0) + record.time_spent_seconds` 累加每次提交的耗时。若前端提交的是"从考试开始到现在的总用时"，则后端会产生重复累加。因此需要改为：`elapsed` 模式下，前端提交 `time_spent_seconds=0` 或不再提交逐题耗时，考试结束提交 `total_time`。
   - **结论**：更稳妥的方案是——`elapsed` 模式下提交答案时不传 `time_spent_seconds`（或传 0），考试结束时由后端在 `/finish` 中根据 `started_at` 和 `finished_at` 计算总时长并写入 `duration_seconds`。

   **修正方案**：
   - `submit_answer` 在 `elapsed` 模式下 `time_spent_seconds` 强制为 0
   - `finish_exam` 增加计算：如果 `timer_mode == "elapsed"`，`duration_seconds = (finished_at - started_at).seconds`
   - 前端按 `time_spent_seconds=0` 提交

## Risks / Trade-offs

- [风险] 考试中途刷新页面后，前端累计用时状态丢失 → [缓解] `examStartedAt` 已保存在 `sessionStorage`，刷新后通过 `startElapsedTimer()` 恢复
- [风险] 暂停/恢复逻辑若出现竞态，累计时间可能不准确 → [缓解] 纯前端计算，单一线程，无并发问题
- [风险] 后端 `finish_exam` 新增逻辑后，需确保不影响 `per_question` 模式 → [缓解] 仅在 `timer_mode == "elapsed"` 时覆盖 `duration_seconds`
