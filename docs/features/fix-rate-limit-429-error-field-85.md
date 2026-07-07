# 修复登录/注册 429 限流错误信息前端丢失（issue #85）

## 背景

登录与注册接口配置了 slowapi 限流（5/minute），触发限流时后端返回 `429`，响应体为 `{"error": "Rate limit exceeded: ..."}`。但前端统一请求封装 `api.request` 在非 2xx 时只读取 `data.detail`，429 响应体没有 `detail` 字段，导致页面只显示泛化的「请求失败」，丢失限流原因。这与 `docs/api/endpoints.md` 中记录的「429 — 请求过于频繁，请稍后重试」不一致。

## 修改范围

- `static/js/api.js`：`api.request` 非 2xx 分支兼容 slowapi 的 `error` 字段；对 `429` 直接返回文档约定的中文友好提示「请求过于频繁，请稍后重试」，不再暴露英文 `Rate limit exceeded` 细节。
- `test_integration.py`：新增 `test_01f_rate_limit_429_returns_error_field`，清空限流计数后连续请求 login 接口触发 429，断言响应体包含 `error` 字段，固化前后端契约。

不动后端 429 handler（保持 slowapi 默认 `error` 字段），不改设计方向。

## 验证

- `ruff check .` — 0 错误。
- `pytest test_integration.py -v` — 98 项全部通过。
- 单独运行 429 契约测试通过：前 5 次请求返回 401，第 6 次返回 429 且响应体含 `error` 字段。

## 已知限制

- 前端 `api.request` 对 429 统一展示中文提示，不区分具体限流配额（如 5/minute）。如需展示剩余等待时间需后端补充字段，属后续增强，不在本次范围。
