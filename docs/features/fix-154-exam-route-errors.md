# 修复：/exam 路由补全错误处理，不再永久卡骨架屏（issue #154）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #154

## 问题

`/exam` 是全部路由中唯一没有 try/catch 的：`api.getExamProgress` 等请求失败时
异常成为 unhandled rejection，页面永久停留在骨架屏（"第 0/0 题" + spinner），
无错误提示。触发源包括网络失败、考试记录被删（404），以及损坏的
`sessionStorage.activeExamId`（`parseInt('abc')` → NaN → 请求 `/api/exam/NaN` → 422）。

## 修复

- **入口防护**：`parseInt` 后 `Number.isNaN(examId)` 时清掉 activeExamId 快照并
  回退 `/exam/setup`，不发起必败请求。
- **主体 try/catch**（与 dashboard/banks/history/review 等路由同口径）：失败时
  渲染「加载失败(状态码)」+「返回答题设置」入口；清理已启动的整卷计时 interval。
- **快照清理策略**：404/422（考试已不存在/参数非法）清掉 activeExamId，避免刷新
  反复撞同一错误；网络失败（无 err.status）**保留**快照，服务恢复后刷新可继续作答。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 40 pass（新增 3 项）
```

新增 `tests/frontend/exam_route_errors.test.js`：损坏 activeExamId 回退 setup 并
清快照；404 渲染错误 + 清快照；网络失败渲染错误但保留快照。
已红-绿验证：旧代码下 3 项全部失败（unhandled rejection）。

## 已知限制

- 错误提示为整页替换（与其他路由口径一致），未做骨架屏内局部提示；
  错误状态的统一视觉规范属 #163 的系统性工作。
