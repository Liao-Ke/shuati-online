# 修复：删除题库成功后列表立即刷新（issue #153）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #153

## 问题

删除题库成功后 `router.navigate('/banks')` 刷新列表，但 `navigate` 只是赋值
`location.hash`——删除按钮只存在于 `/banks` 页本身，同值赋值不触发 hashchange，
路由不重渲染。被删题库的卡片残留，点详情报「加载失败」，手动刷新才消失。
`doDeleteQuestion`/`saveQForm` 早已正确使用 `router.resolve()`，此处为遗漏点。

## 修复

一行对齐既有口径：`confirmDeleteBank` 删除成功回调 `router.navigate('/banks')`
→ `router.resolve()`。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 38 pass（新增 1 项）
```

新增 `tests/frontend/delete_bank_refresh.test.js`：hash 已在 `#/banks` 时删除成功
应调用 `router.resolve()` 重渲染。已红-绿验证：旧代码下失败（仅做同 hash no-op）。

## 已知限制

- 无。
