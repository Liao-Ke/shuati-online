# 修复：题库列表「更新于」日期走 parseUtcDate（issue #158）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #158

## 问题

后端返回无时区后缀的 naive UTC isoformat（如 `2026-07-26T17:34:26.993831`），
题库卡片「更新于」直接 `new Date(b.updated_at)`——ES 规范把无 offset 的
date-time 字符串按**本地时间**解析，显示的实际是 UTC 日期。UTC+8 环境下
本地 00:00–07:59 的导入/编辑显示成前一天。

项目已为同一问题引入 `parseUtcDate`（补 Z 后缀），`started_at` 全部展示点
均已使用，此处为唯一漏改点（已 grep 复核 app.js 无其他后端时间裸解析）。

## 修复

一行：`app.js` 题库卡片 `new Date(b.updated_at)` → `parseUtcDate(b.updated_at)`。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 38 pass（新增 1 项）
```

新增 `tests/frontend/bank_updated_at_tz.test.js`：固定 `TZ=Asia/Shanghai`，
渲染 `/banks` 路由，naive UTC `2026-07-26T23:30` 应显示本地日期 `2026/7/27`。
已红-绿验证：旧代码渲染为 `2026/7/26`（早一天），修复后通过。

## 已知限制

- 无。行为与 `started_at` 各展示点完全一致。
