# 修复：单题倒计时生命周期泄漏的两条入口（issue #151）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #151（#52/#73 堵住「切整卷模式」入口后的两个残留入口）

## 问题

单题倒计时归零自动 `submitCurrentAnswer()`，两条路径让它在不该运行时运行：

1. **暂停→恢复凭空重启**：`resumeExam` 无条件 `startTimer(examPauseRemaining)`。
   回看已作答题目时倒计时已清、计时区文本为空，`parseTime('')` 得 0，恢复后
   1 秒即自动提交 → 无端 400 弹窗；整卷模式下则以 null 答案静默判错并弄乱 UI。
2. **离开考试页不清理**：路由 handler 均不清 `examTimerInterval`，答题中经顶部
   导航离开后倒计时后台跑到归零照常提交 → 当前题静默判错；若期间开了新考试，
   还会用新 examId + 旧题号交叉提交。

## 修复

- `pauseExam`：清 interval **前**记录 `hadCountdown`；per_question 分支
  `examPauseRemaining = hadCountdown ? parseTime(...) : null`。
- `resumeExam`：`examPauseRemaining !== null` 才 `startTimer`——null 表示暂停时
  本就没有进行中的倒计时。
- 模块级新增 hashchange 清理监听：hash 离开 `/exam` 即清 `examTimerInterval`。
  （elapsed 计时不在本 issue 范围：其归零不触发提交，且 /exam 路由重入时自清重启。）

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 41 pass（新增 4 项）
```

新增 `tests/frontend/timer_lifecycle.test.js`：无倒计时暂停→恢复不启动 interval；
真有倒计时时暂停/恢复按剩余秒数重启（回归）；离开考试页清 interval；
仍在 /exam 时清理守卫不误清。已红-绿验证：旧代码下入口一/入口二用例失败。

## 已知限制

- 交叉提交场景（离开后开新考试）由入口二的清理从根上消除，未单独造用例。
- 计时器测试 stub 不推进时间（interval 回调不执行），验证的是生命周期而非倒数行为。
