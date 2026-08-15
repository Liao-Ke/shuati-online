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
| hashchange 离开 `/exam` | 入口二：离开考试页即停倒计时（路由判定忽略 query 串，与 `showNav` 同口径） |
| `loadQuestionByIndex` | 切题先停旧倒计时，新题渲染后按需重启 |
| `pauseExam` | 暂停前记录 `hadCountdown`，随后停表置空 |
| `finishExam` | 非暂停时交卷停表；暂停中计时器已停，直接交卷避免先重启再停 |
| `toggleExamMode` | 进入整卷模式停单题倒计时（#52） |
| `startTimer` 重启前 / 归零回调 | 重启不叠加；归零自动提交前先置空 |
| `submitCurrentAnswer` | 手动提交停表 |
| `resetSessionState` | 会话状态重置 |

### 暂停/恢复守卫

- `pauseExam`：清 interval **前**记录 `hadCountdown`；per_question 分支
  `examPauseRemaining = hadCountdown ? parseTime(...) : null`。
- `resumeExam`：`examPauseRemaining !== null` 才 `startTimer`——null 表示暂停时
  本就没有进行中的倒计时，回看已作答题/整卷模式/交卷后均不会凭空重启。
- `examPauseRemaining` 初值及 `/exam` 路由、`resetSessionState` 两个重置点统一为
  `null`，与守卫语义自洽（此前是 `0`，虽然不可达但存在两套空值表示）。
- 边界：暂停瞬间切题请求在途时，`loadQuestionByIndex` 完成后不再立即启动倒计时，
  而是置 `examPendingTimer = true` 挂起；恢复时按该题默认时长补启动全新倒计时，
  避免暂停状态下倒计时归零静默提交新题。

### 离开考试页清理

- 模块级新增 hashchange 清理监听：hash 离开 `/exam` 即调用 `stopExamTimer()`；
  路由判定用 `split('?')[0]` 忽略 query 串，避免 `#/exam?x=y` 被误判为已离开。
- 边界：切题请求在途时离开考试页或已开新考试，`loadQuestionByIndex` 收到响应后
  丢弃过期结果（比较请求时的 examId 与当前路由），不渲染、不启动倒计时；
  stale-guard 与清理监听同口径忽略 query 串，避免两处守卫对同一 hash 结论相反。
  （elapsed 计时不在本 issue 范围：其归零不触发提交，且 /exam 路由重入时自清重启。）

### 一致性收尾

- 新增 `stopElapsedTimer()` 统一整卷计时的「清 interval 并置 null」，替换
  result 路由、`pauseExam`、`finishExam`、`startElapsedTimer`、`resetSessionState`
  等清理点，与单题倒计时保持同一不变式。
- `stopExamTimer`/`stopElapsedTimer` 判空统一为 `!== null`，消除真值判断混用。
- `finishExam` 暂停中直接交卷：`pauseExam` 已停掉全部计时器，先 `resumeExam`
  再停表只会白启动一次又立即停掉；接口失败时仍保持暂停态供用户继续。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 50 pass（timer_lifecycle 共 13 项）
```

`tests/frontend/timer_lifecycle.test.js` 覆盖：

- 无倒计时暂停→恢复不启动 interval（入口一守卫）；
- 真有倒计时时暂停/恢复按剩余秒数重启（回归）；
- 离开考试页清 interval、仍在 `/exam` 不误清、带 query 的 `/exam` 不误清（入口二及其边界）；
- 切题请求在途时离开考试页，完成后不渲染旧题、不启动后台倒计时（入口二异步边界）；
- 带 query 的 `/exam` 下 stale-guard 与清理监听同口径放行，切题响应照常渲染；
- 旧考试切题请求在途时开启新考试，完成后按 examId 丢弃过期响应、
  不渲染旧题、不启动后台倒计时（examId 分支的交叉提交防线）；
- **主复现路径**：`startTimer(60)` → `loadQuestionByIndex` 渲染已作答题 →
  暂停→恢复，断言不再启动第 2 条 interval；
- **提交路径**：手动 `submitCurrentAnswer` 停表后暂停→恢复不重启、不重复提交；
- **归零路径**：手动触发归零回调自动提交后暂停→恢复不重启、不重复提交；
- 暂停期间切题请求完成：暂停中不启动倒计时，恢复时补启动全新倒计时；
- **收尾路径**：`finishExam` 停表后暂停→恢复不重启；暂停中交卷不额外重启倒计时。

已红-绿验证（最终 13 项用例分别运行在仓库历史版本上）：

- PR 前 base `a15ceee`：两条入口及全部残留路径均红；
- 第一 commit `56cdec7`（仅 pause 守卫 + hashchange 内联清理）：主复现/提交/归零/收尾与异步边界仍红；
- 上一版 head `d737c55`：仅「带 query 不误清」「暂停中交卷不重启」2 项红；
- 上一版 head `e140829`：仅新增的「带 query stale-guard 同口径放行」1 项红，
  证明一致性收尾的测试不是假绿；
- 修复版：前端套件 50 项全部通过（timer_lifecycle 13/13）。

## 已知限制

- 计时器测试 stub 不推进真实时间：归零路径通过手动触发 interval 回调验证，
  其余用例验证的是计时器生命周期（启停/引用状态）而非真实倒数行为。
- 测试未覆盖真实浏览器 hashchange 事件调度时序与接口网络竞争，依赖人工/端到端验证。
