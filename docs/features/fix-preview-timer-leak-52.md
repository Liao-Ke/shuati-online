# 修复单题倒计时切整卷模式后残留自动提交（#52）

**日期：** 见文件修改时间  &emsp; **关联 Issue：** #52

## 目标

单题倒计时（`timer_mode = "per_question"`）模式下，用户切换到整卷模式后，`examTimerInterval` 未被清理，倒计时在后台继续运行。归零时 `startTimer` 回调触发 `submitCurrentAnswer()`，会在用户不知情的情况下自动提交当前题（可能提交 `null` 判错），并调用 `loadQuestionByIndex()` 把整卷预览内容覆盖为单题内容。本次在进入整卷模式时清理计时器，消除后台自动提交。

## 修改范围

- `static/js/app.js`：`toggleExamMode()` 整卷模式分支

## 核心实现

在 `toggleExamMode()` 进入整卷模式（`examFullPreview === true`）分支开头，停止单题倒计时：

```javascript
if (examFullPreview) {
  // 进入整卷模式：停止单题倒计时，避免归零后后台自动提交当前题（#52）
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
  ...
}
```

返回单题模式（`else` 分支）原本就调用 `loadQuestionByIndex(examCurrentIndex)`，其中会先 `clearInterval` 再按 `examTimerMode` 通过 `startTimer()` 重新启动当前题的倒计时，行为保持不变。

## 影响范围

- 仅整卷模式切换的计时器生命周期
- `elapsed` 整卷计时模式不受影响（`examTimerInterval` 在该模式下始终为 `null`，清理为空操作）
- 单题模式内的导航、提交、倒计时行为不变

## 验证方式

1. `node --check static/js/app.js` 语法通过
2. `pytest test_integration.py` 72 项集成测试全部通过（无后端改动，仅回归确认）
3. 红绿验证（node 模拟 `startTimer` + `toggleExamMode`）：
   - 修复前：进入整卷模式后倒计时归零 → `autoSubmitted = true`（bug 复现）
   - 修复后：进入整卷模式后 `examTimerInterval = null`，倒计时归零不再触发 `autoSubmitted`（`false`）

## 已知限制

- 进入整卷模式时单题剩余倒计时被丢弃；返回单题模式时 `loadQuestionByIndex` → `startTimer()` 以 `examTimeoutSeconds` 重新开始完整倒计时（与题目导航时重置计时器的既有行为一致），符合 issue #52 期望的「回到单题模式后再为当前题重新启动对应计时」。
