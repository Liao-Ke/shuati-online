# 修复：单题倒计时生命周期泄漏的两条入口（issue #151）

**日期：** 2026-08-15  &emsp; **关联 Issue：** #151（#52/#73 堵住「切整卷模式」入口后的两个残留入口）

## 问题

单题倒计时归零自动 `submitCurrentAnswer()`，两条路径让它在不该运行时运行：

1. **暂停→恢复凭空重启**：`resumeExam` 无条件 `startTimer(examPauseRemaining)`。
   回看已作答题目时倒计时已清、计时区文本为空，`parseTime('')` 得 0，恢复后
   1 秒即自动提交 → 无端 400 弹窗；整卷模式下则以 null 答案静默判错并弄乱 UI。
2. **离开考试页不清理**：路由 handler 均不清 `examTimerInterval`，答题中经顶部
   导航离开后倒计时后台跑到归零照常提交 → 当前题静默判错；若期间开了新考试，
   还会用新 examId + 旧题号交叉提交。

## 修复

### 收敛计时器不变式：`examTimerInterval 非 null ⇔ 倒计时正在运行`

初版仅给 `pauseExam` 加了 `hadCountdown` 守卫，但代码库存在多处
「只 `clearInterval` 不置 `null`」的清理点（切题、提交、归零回调、交卷），
陈旧 interval ID 会让 `hadCountdown = examTimerInterval !== null` 误判为
「有进行中的倒计时」，issue 给出的最简复现路径仍然成立。

现新增 `stopExamTimer()` 统一「清 interval 并置 null」，并替换全部清理点：

| 清理点 | 说明 |
| --- | --- |
| hashchange 离开 `/exam` | 入口二：离开考试页即停倒计时 |
| `loadQuestionByIndex` | 切题先停旧倒计时，新题渲染后按需重启 |
| `pauseExam` | 暂停前记录 `hadCountdown`，随后停表置空 |
| `finishExam` | 交卷停表 |
| `toggleExamMode` | 进入整卷模式停单题倒计时（#52） |
| `startTimer` 重启前 / 归零回调 | 重启不叠加；归零自动提交前先置空 |
| `submitCurrentAnswer` | 手动提交停表 |
| `resetSessionState` | 会话状态重置 |

### 暂停/恢复守卫

- `pauseExam`：清 interval **前**记录 `hadCountdown`；per_question 分支
  `examPauseRemaining = hadCountdown ? parseTime(...) : null`。
- `resumeExam`：`examPauseRemaining !== null` 才 `startTimer`——null 表示暂停时
  本就没有进行中的倒计时，回看已作答题/整卷模式/交卷后均不会凭空重启。
- 边界：暂停瞬间切题请求在途时，`loadQuestionByIndex` 完成后不再立即启动倒计时，
  而是置 `examPendingTimer = true` 挂起；恢复时按该题默认时长补启动全新倒计时，
  避免暂停状态下倒计时归零静默提交新题。

### 离开考试页清理

- 模块级新增 hashchange 清理监听：hash 离开 `/exam` 即调用 `stopExamTimer()`。
- 边界：切题请求在途时离开考试页或已开新考试，`loadQuestionByIndex` 收到响应后
  丢弃过期结果（比较请求时的 examId 与当前路由），不渲染、不启动倒计时。
  （elapsed 计时不在本 issue 范围：其归零不触发提交，且 /exam 路由重入时自清重启。）

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 47 pass（timer_lifecycle 共 10 项）
```

`tests/frontend/timer_lifecycle.test.js` 覆盖：

- 无倒计时暂停→恢复不启动 interval（入口一守卫）；
- 真有倒计时时暂停/恢复按剩余秒数重启（回归）；
- 离开考试页清 interval、仍在 `/exam` 不误清（入口二及其边界）；
- 切题请求在途时离开考试页，完成后不启动后台倒计时（入口二异步边界）；
- **主复现路径**：`startTimer(60)` → `loadQuestionByIndex` 渲染已作答题 →
  暂停→恢复，断言不再启动第 2 条 interval；
- **提交路径**：手动 `submitCurrentAnswer` 停表后暂停→恢复不重启、不重复提交；
- **归零路径**：手动触发归零回调自动提交后暂停→恢复不重启、不重复提交；
- 暂停期间切题请求完成：暂停中不启动倒计时，恢复时补启动全新倒计时；
- **收尾路径**：`finishExam` 停表后暂停→恢复不重启。

已红-绿验证：对旧代码（只清不置 null）运行，主复现/提交/归零/收尾 4 项失败；
对仅收敛不变式、未加两个异步边界的中间版本运行，两条边界用例分别失败；
修复版 47 项全部通过。

## 已知限制

- 交叉提交场景（离开后开新考试）由「离开即停表 + 过期响应丢弃」从根上消除，
  其中过期响应丢弃路径未单独造“旧请求晚于新考试完成”的用例，仅验证了离开路由分支。
- 计时器测试 stub 不推进真实时间：归零路径通过手动触发 interval 回调验证，
  其余用例验证的是计时器生命周期（启停/引用状态）而非真实倒数行为。
- 测试未覆盖真实浏览器 hashchange 事件调度时序与接口网络竞争，依赖人工/端到端验证。
