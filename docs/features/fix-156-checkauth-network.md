# 修复：checkAuth 网络失败不再销毁本地 token（issue #156）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #156（#89/#108「401 清 token 跳登录」的反方向补全）

## 问题

`checkAuth` 把 `api.me()` 的所有异常一视同仁 `api.setToken(null)`。后端重启/断网/
代理瞬断时 fetch 抛 TypeError（无 `err.status`），合法未过期的 token 被前端主动
删除——服务恢复后刷新仍是登录页，必须重新输入密码。

## 修复

按 `err.status` 区分（`api.request` 的 HTTP 错误带 status，网络异常没有）：
只有服务端明确 401 才清 token；网络失败与非 401 HTTP 错误（如 500）保留凭证、
返回未认证，服务恢复后刷新即恢复会话。

注：`api.request` 全局的 401 处理（`_handle401`）对 `/auth/me` 是白名单直通，
清 token 的职责本就落在 `checkAuth`，本修复不与其重叠。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 41 pass（新增 4 项）
```

新增 `tests/frontend/checkauth_network.test.js`：网络 TypeError 保留 token、
500 保留 token、401 清 token、有效 token 正常认证。
已红-绿验证：旧代码下前两项失败（token 被误删）。

## 已知限制

- 网络失败时用户仍会被带到登录页（init 的未认证分支），但 token 未销毁，
  服务恢复后刷新即回会话；「区分展示网络错误页」属 #154/#163 的错误状态范畴。
