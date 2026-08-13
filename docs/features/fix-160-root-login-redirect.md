# 修复：已登录用户访问根路径/登录页直接进仪表盘（issue #160）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #160

## 问题

已登录用户直接访问站点根 URL（无 hash）看到登录表单：空 hash 在路由解析中
回退 `/login`，`init()` 只处理未登录跳转，而 `/login`/`/register` 路由无条件
渲染表单、不检查 `state.user`。用户被要求重复登录，误以为登录态丢失。

## 修复

`/login` 与 `/register` 路由 handler 顶部加已登录守卫：`state.user` 存在时
`router.navigate('/dashboard')` 并返回。根路径（空 hash 回退 /login）与手动
访问 `#/login`、`#/register` 三种入口统一覆盖。logout 与 auth-expired 流程
不受影响（彼时 `state.user` 已置 null）。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 40 pass（新增 3 项）
```

新增 `tests/frontend/root_login_redirect.test.js`：已登录空 hash → `/dashboard`；
已登录 `#/register` → `/dashboard`；未登录空 hash 仍停留 `/login`。
已红-绿验证：旧代码下前两项失败。

## 已知限制

- 无。
