# 修复整卷计时模式（elapsed）实现

**日期：** 见文件修改时间  &emsp; **关联 PRD：** [exam-platform.md](../prd/exam-platform.md)


## 目标

整卷计时模式（`elapsed`）选中后仍执行逐题倒计时并自动提交，与"记录总用时，不限时作答"的设计意图不符。修复后该模式仅累计总用时，不对作答施加时间限制。

## 修改范围

- `static/js/app.js`：`loadQuestionByIndex`、`submitCurrentAnswer`、`startElapsedTimer`、`pauseExam`/`resumeExam`、`startExam`、`toggleExamMode`、`init`、`finishExam`
- `routers/exam.py`：`finish_exam`、`submit_answer` 的 `is_last` 分支

## 核心实现

1. **停用逐题倒计时**（`loadQuestionByIndex`）：`elapsed` 模式下跳过 `examTimeoutSeconds` 设置、`state.questionStartTime` 记录和 `startTimer()` 调用
2. **提交时间计算**（`submitCurrentAnswer`）：`elapsed` 模式下 `timeSpent` 固定传 0
3. **累计总用时显示**（`startElapsedTimer`）：`elapsed` 模式下将累计用时写入 `#exam-timer`（而非 `#exam-elapsed`），隐藏 `#exam-elapsed`
4. **暂停恢复适配**（`pauseExam`/`resumeExam`）：`elapsed` 模式下暂停清除 `examElapsedInterval`，将当前值存入 `examElapsedOffset`（同步 `sessionStorage`）；恢复时重置 `examStartedAt`，重启计时器
5. **刷新恢复累计用时**：`examElapsedOffset` 随暂停写入 `sessionStorage`，页面加载时恢复
6. **后端写入总用时**（`finish_exam`/`submit_answer`）：`elapsed` 模式下根据 `started_at` 和 `finished_at` 计算 `duration_seconds`
7. **修复时区 BUG**：后端 `started_at.isoformat()` 返回的 UTC 时间不含时区标记，浏览器 `new Date(str)` 会当作本地时间解析导致多算 8 小时；在 `startExam` 中追加 `Z` 后缀强制按 UTC 解析

## 影响范围

- `per_question` 模式行为完全不变
- 仅影响 `elapsed` 模式的计时、提交、暂停行为
- 新增全局变量 `examElapsedOffset`

## 验证方式

- 48 个集成测试全部通过
- 手动验证项见 tasks.md 4.1-4.5

## 已知限制

- `duration_seconds` 通过 `finished_at - started_at` 计算，包含暂停期间的耗时（前端无法精确回传暂停偏移）
