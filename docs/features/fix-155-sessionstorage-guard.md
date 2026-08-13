# 修复：sessionStorage 损坏 JSON 统一防护，根除启动白屏卡死（issue #155）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #155

## 问题

`init()` 反序列化 `sessionStorage.reviewFilter` 无防护，非法 JSON 时 `JSON.parse` 抛异常
发生在 `checkAuth()` 与 `router.resolve()` 之前——启动中断，首屏永久停留在初始 spinner。
`/review` 路由存在同款裸 `JSON.parse`。`getExamTimeoutSeconds` 早有 try/catch 防护，
其 ponytail 注释已声明升级路径「未来若 sessionStorage JSON 变多再抽通用 safeParse」，
本次即该路径的落地（第 3 处出现）。

## 修复

- `static/js/app.js` 新增 `safeSessionJSON(key, fallback)`：损坏值按不存在处理、
  **removeItem 清掉**（避免每次刷新重复触发）并返回 fallback。
- 三处调用点统一收口：`init()`（回退 null，正常进入应用）、`/review` 路由
  （回退 null → 跳 `/review/setup`）、`getExamTimeoutSeconds`（回退默认时长，行为不变）。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 41 pass（新增 4 项）
```

新增 `tests/frontend/session_storage_guard.test.js`：
- `safeSessionJSON` 损坏值回退 + 清 key；正常值解析；缺失值不误删；
- `init()` 注入损坏 reviewFilter 后仍走到 `router.resolve()`（对应白屏卡死的根因路径）；
- `/review` 路由损坏时回退 `/review/setup` 而非抛异常。

已红-绿验证：旧代码下 4 项测试全部失败。

## 已知限制

- 仅覆盖 sessionStorage 来源的 JSON；服务端数据（`q.options` 等）的裸 `JSON.parse`
  是另一类信任边界，未在本次范围（部分已有局部 try/catch）。
