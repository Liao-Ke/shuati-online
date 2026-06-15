## Context

当前 JWT 签发 (`create_access_token`) 仅包含 `user_id` 和 `exp`。验证 (`get_current_user`) 仅检查 `exp` 和签名。python-jose 文档推荐完整的声明验证：issuer、audience、issued-at、leeway。

## Goals / Non-Goals

**Goals:**
- Token 增加 `iss`、`aud`、`iat` 声明
- 验证端启用完整检查：`require_exp`、`verify_aud`、`verify_iss`、`leeway`
- 防止其他服务签发的 HS256 token 被误用

**Non-Goals:**
- 不引入 RS256/RSA 非对称签名（`fix-hardcoded-secret-key` 已解决密钥生成问题，非对称方案过度设计）
- 不引入 token 吊销/refresh 机制

## Decisions

### Issuer/Audience 值：硬编码常量

- **选择**：`JWT_ISSUER = "shuati-online"`、`JWT_AUDIENCE = "shuati-api"`
- **理由**：单体应用无多租户，固定值即可。通过常量集中管理，未来可通过环境变量覆盖

### Leeway：60 秒

- **选择**：`leeway=60`
- **替代方案**：`leeway=10`（python-jose 官方示例）、`leeway=0`
- **理由**：小型 VPS 部署 NTP 同步可能不精确，60s 是保守但安全的平衡

### 验证选项：显式全开启

- **选择**：`options={"verify_signature": True, "verify_exp": True, "verify_aud": True, "verify_iss": True, "require_exp": True, "leeway": 60}`
- **理由**：python-jose 的默认选项部分启用部分不启用，显式声明所有选项避免默认行为变化

## Risks / Trade-offs

- **[旧 token 失效]** 已签发的 token 不含 `iss`/`aud`/`iat`，过渡期内会被拒绝 → token 最长 7 天过期，自然轮换。无需特殊迁移策略
- **[增加 token 体积]** 新增 3 个字段，每次请求多约 100 字节 → 可忽略
