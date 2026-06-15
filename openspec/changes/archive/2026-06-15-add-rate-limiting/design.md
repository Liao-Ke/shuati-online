## Context

`POST /api/auth/login` 无任何速率限制。由于应用使用 SQLite（无连接池），暴力攻击不仅威胁安全性，也可能消耗数据库连接导致服务不可用。

## Goals / Non-Goals

**Goals:**
- 登录接口限流 5 次/分钟/IP
- 无需外部依赖（Redis）

**Non-Goals:**
- 不对其他端点限流（注册、API 查询等）
- 不做分布式限流

## Decisions

### 限流库选择：slowapi（内存） vs fastapi-limiter（Redis）

- **选择**：`slowapi` + 内存存储
- **替代方案**：fastapi-limiter，需要 Redis
- **理由**：单容器单 worker 部署，内存限流足够。slowapi 是 FastAPI 限流的事实标准库，API 简洁

### 限流阈值：5 次/分钟

- **选择**：`"5/minute"`
- **理由**：正常用户不会 1 分钟输错 5 次密码；对暴力攻击形成有效阻碍

### 限流粒度：按 IP

- **选择**：`key_func=get_remote_address`（slowapi 默认）
- **理由**：简单有效；不用考虑用户未登录时无 user_id 的问题

## Risks / Trade-offs

- **[内存存储重启丢失]** 服务重启后计数清零 → 攻击者可利用重启窗口。对于小型应用可接受
- **[代理后 IP]** 如果前面有 Nginx，需配置 `proxy_headers=True` 或使用 `X-Forwarded-For` → 当前 Docker 直连无此问题
