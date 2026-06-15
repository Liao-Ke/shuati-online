## Why

当前 JWT 签发和验证仅包含 `user_id` 和 `exp`，缺少 `iss`（签发者）、`aud`（受众）、`iat`（签发时间），且验证时无 `leeway` 时钟容差、无 `require_exp` 强制检查。攻击者若获取其他服务签发的 HS256 token，可能被本服务误接受。

## What Changes

- `auth.py` 新增常量 `JWT_ISSUER = "shuati-online"`、`JWT_AUDIENCE = "shuati-api"`、`JWT_LEEWAY = 60`
- `create_access_token`：token payload 增加 `iss`、`aud`、`iat` 字段
- `get_current_user`：`jwt.decode()` 增加 `audience`、`issuer`，`options` 启用完整验证（`verify_aud`、`verify_iss`、`require_exp`、`leeway`）

## Capabilities

### New Capabilities

- `jwt-issuer-audience`: Token 包含 issuer 和 audience 声明
- `jwt-issued-at`: Token 包含 issued-at 时间
- `jwt-clock-leeway`: 验证时容忍 60 秒时钟漂移

### Modified Capabilities

<!-- 无 — 旧 token（7天过期前）在过渡期后自然失效，无 spec 行为变更 -->

## Impact

- `auth.py`：`create_access_token` 和 `get_current_user` 两函数
