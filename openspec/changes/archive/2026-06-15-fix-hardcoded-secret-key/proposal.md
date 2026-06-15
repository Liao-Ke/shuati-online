## Why

`auth.py` 中硬编码了 `SECRET_KEY` 默认值 `"exam-platform-secret-key-change-in-production"`。该值一经公开或被扫描发现，攻击者可直接伪造任意用户的 JWT token，完全绕过认证。Docker Compose 部署时也未注入此环境变量，生产部署将直接使用该默认值。

## What Changes

- **BREAKING**：移除硬编码默认 SECRET_KEY，开发环境改为 `secrets.token_hex(32)` 自动生成随机 key（每次重启 key 变化，需重新登录）
- `docker-compose.yml` 新增 `${SECRET_KEY:?}` 必填校验，忘记配置时启动报错
- 保留 `SECRET_KEY` 环境变量读取逻辑

## Capabilities

### New Capabilities

- `secret-key-hardening`: SECRET_KEY 不得硬编码，开发环境自动生成随机 key，生产环境强制注入

### Modified Capabilities

<!-- 无 -->

## Impact

- `auth.py`：SECRET_KEY 赋值逻辑
- `docker-compose.yml`：environment 段新增
