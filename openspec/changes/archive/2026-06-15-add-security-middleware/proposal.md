## Why

当前 `main.py` 未配置任何安全中间件：无 CORS 头控制、无 Host 头校验。存在跨域攻击和 Host 头注入风险。

## What Changes

- `main.py` 添加 `CORSMiddleware`：允许源由 `CORS_ORIGINS` 环境变量控制（逗号分隔），默认 `["*"]`
- `main.py` 添加 `TrustedHostMiddleware`：允许 Host 由 `ALLOWED_HOSTS` 环境变量控制，默认 `["*"]`

## Capabilities

### New Capabilities

- `cors-middleware`: CORS 跨域请求控制
- `trusted-host-middleware`: Host 头白名单校验

### Modified Capabilities

<!-- 无 -->

## Impact

- `main.py`：新增两段 `app.add_middleware()` 调用
