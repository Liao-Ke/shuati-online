## Context

`main.py` 当前未注册任何 Starlette/FastAPI 中间件。作为面向公网部署的 Web 应用，缺少 CORS 控制和 Host 头校验增加了攻击面。

## Goals / Non-Goals

**Goals:**
- 添加 `CORSMiddleware` 和 `TrustedHostMiddleware`
- 通过环境变量控制白名单，默认宽松（开发友好），生产可收紧

**Non-Goals:**
- 不添加 `HTTPSRedirectMiddleware`（反代层负责 HTTPS）
- 不添加 `GZipMiddleware`（当前静态资源量很小）

## Decisions

### 默认策略：`["*"]` 全允许

- **选择**：`CORS_ORIGINS` 和 `ALLOWED_HOSTS` 默认 `["*"]`
- **替代方案**：默认拒绝，强制配置 — 开发体验差
- **理由**：SPA 同域部署时不需要限制；生产部署通过环境变量收紧

### CORS allow_credentials：True

- **选择**：`allow_credentials=True`
- **理由**：Bearer token 需要在跨域请求中携带 Authorization 头。即使同域部署不影响，预留跨域能力

## Risks / Trade-offs

- **[`["*"]` 默认可能被误用]** 如果用户不配置环境变量直接上生产 → 依赖文档和部署指南提醒
