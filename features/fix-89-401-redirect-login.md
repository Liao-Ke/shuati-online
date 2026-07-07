# 修复：登录态失效 401 统一清理 token 并跳转登录页

## 关联

- GitHub Issue: #89
- 分支: `fix/89-401-redirect-login`

## 问题

前端仅在 `init()` 时调用一次 `checkAuth()` 校验 token。应用运行期间若受保护 API 返回 401（JWT 过期 / SECRET_KEY 变化 / 用户被删除），`api.request()` 仅抛出通用错误，各页面 catch 渲染"加载失败"，不会清理 token、不会跳转登录页。

## 修改范围

### `static/js/api.js`

- 新增 `_isAuthPath(path)` 判断请求是否为认证端点（`/auth/login`、`/auth/register`、`/auth/me`），避免登录页自身 401 触发死循环。
- 新增 `_handle401(path)` 统一处理：清除 token + 派发 `auth-expired` CustomEvent。
- `request()` 方法在 `!res.ok` 分支中，`res.status === 401` 时调用 `_handle401(path)`，然后保留原有 `throw`。
- `exportBank()` 独立 fetch 同样增加 401 处理。

### `static/js/app.js`

- 注册 `window.addEventListener('auth-expired', ...)` 监听器，清除 `state.user` 并跳转 `/login`。
- 使用 CustomEvent 解耦，api.js 无需直接引用 app.js 的 state/router。

## 验证方式

1. `pytest test_integration.py -v` — 97 项全通过
2. 浏览器手动验证：
   - 登录后修改 localStorage token 为无效值 → 点击受保护页面 → 自动跳回登录页
   - 登录页输入错误密码 → 正常显示错误提示，不死循环
