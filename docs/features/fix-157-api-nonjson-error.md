# 修复：api.request 非 JSON 错误响应不再抛 SyntaxError 原文（issue #157）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #157（#85/#94 的 429 文案提取为相邻先例）

## 问题

`api.request` 在判断 `res.ok` 之前无条件 `await res.json()` 且无兜底。反向代理返回
HTML 错误页（502/504）或服务端 500 空 body 时抛 `SyntaxError`：

- 调用点的 `alert(err.message)` 把 `Unexpected token '<'...` 原文弹给用户；
- 异常无 `err.status`，依赖状态码的分支（如恢复考试识别 409）全部失效。

同文件 `exportBank` 已有 `res.json().catch(() => ({}))` 防护先例，`request` 未跟进。

## 修复

`static/js/api.js` `request()`：

- `res.json()` 包 try/catch，解析失败置 `data = undefined`（JSON.parse 不可能产出
  undefined，可安全区分「解析失败」与「合法 null」）。
- 错误分支：文案回退 `请求失败(状态码)`，`err.status` 始终可用；非 JSON 的 401
  仍走 `_handle401`（清 token + auth-expired）。
- 成功分支（res.ok 但 body 非 JSON，如被强制门户劫持）：抛 `响应解析失败(状态码)`
  带 status，不再让 SyntaxError 裸奔，也不静默返回空对象掩盖异常。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 41 pass（api_request.test.js 新增 4 项）
```

新增用例：502 HTML 页 → `请求失败(502)`；500 空 body → `请求失败(500)`；
非 JSON 401 仍触发 auth-expired；200 非 JSON → `响应解析失败(200)`。
已红-绿验证：旧代码下 4 项全部失败（抛 SyntaxError）。

## 已知限制

- 各调用点的 `alert(err.message)` 展示方式不变（错误呈现层的统一属 UI 范畴，
  相关空/错误状态问题由 #154/#156 等单独跟踪）。
