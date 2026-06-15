## 1. 前端：停用逐题倒计时（elapsed 模式）

- [x] 1.1 在 `loadQuestionByIndex` 中根据 `examTimerMode` 判断：`elapsed` 模式下不设置 `examTimeoutSeconds`，不调用 `startTimer()`
- [x] 1.2 在 `submitCurrentAnswer` 中根据 `examTimerMode` 判断：`elapsed` 模式下 `timeSpent` 传 0

## 2. 前端：累计总用时显示

- [x] 2.1 修改 `startElapsedTimer`：`elapsed` 模式下将累加结果写入 `#exam-timer`（而非 `#exam-elapsed`），并隐藏 `#exam-elapsed`
- [x] 2.2 在 `/exam` 路由初始化中，`elapsed` 模式下调用 `startElapsedTimer()` 替代已有计时逻辑
- [x] 2.3 确保暂停/恢复逻辑（`pauseExam`/`resumeExam`）在 `elapsed` 模式下正确暂停/继续累计用时（利用已有 `examPauseRemaining` 机制适配）
- [x] 2.4 确保 `toggleExamMode` 中 `elapsed` 模式下 `#exam-timer` 显示累计用时而非倒计时
- [x] 2.5 确保页面刷新后累计用时根据 `sessionStorage` 中的 `examStartedAt` 正确恢复

## 3. 后端：考试结束时写入总用时

- [x] 3.1 修改 `routers/exam.py` 中 `finish_exam`：若 `exam.timer_mode == "elapsed"`，根据 `started_at` 和 `finished_at` 计算 `duration_seconds` 并写入

## 4. 验证

- [ ] 4.1 启动服务，选择整卷计时模式开始考试，确认无逐题倒计时显示
- [ ] 4.2 确认总用时随答题正常递增
- [ ] 4.3 确认暂停后总用时停止，恢复继续
- [ ] 4.4 确认提交答案后考试结果页面显示正确的总用时
- [ ] 4.5 确认 `per_question` 模式行为未受影响
- [x] 4.6 运行 `pytest test_integration.py -v` 确认测试通过
