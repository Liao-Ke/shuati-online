## Why

`/api/auth/login` 接口无速率限制，攻击者可通过暴力穷举破解用户密码。

## What Changes

- 引入 `slowapi` 依赖（内存存储，无需 Redis）
- `main.py` 注册 `Limiter` 和 `RateLimitExceeded` 异常处理器
- `routers/auth.py` 的 `login` 端点添加 `@limiter.limit("5/minute")` 限流

## Capabilities

### New Capabilities

- `login-rate-limiting`: 登录接口 5 次/分钟/IP 限流

### Modified Capabilities

<!-- 无 -->

## Impact

- `requirements.txt`：新增 `slowapi`
- `main.py`：新增 limiter 注册
- `routers/auth.py`：login 函数加装饰器
