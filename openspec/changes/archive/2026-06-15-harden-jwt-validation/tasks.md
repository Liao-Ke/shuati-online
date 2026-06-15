## 1. 常量和签发

- [x] 1.1 修改 `auth.py`：新增常量 `JWT_ISSUER = "shuati-online"`、`JWT_AUDIENCE = "shuati-api"`、`JWT_LEEWAY = 60`
- [x] 1.2 修改 `create_access_token`：`to_encode.update()` 中增加 `"iss": JWT_ISSUER`、`"aud": JWT_AUDIENCE`、`"iat": <utc now>`

## 2. 验证逻辑

- [x] 2.1 修改 `get_current_user`：`jwt.decode()` 调用增加 `audience=JWT_AUDIENCE`、`issuer=JWT_ISSUER`
- [x] 2.2 增加 `options` 参数：`"verify_signature": True, "verify_exp": True, "verify_aud": True, "verify_iss": True, "require_exp": True, "leeway": JWT_LEEWAY`

## 3. 验证

- [x] 3.1 运行 `pytest test_integration.py -v`，确认全部认证相关测试通过（新 token 包含 iss/aud/iat）
- [x] 3.2 构造一个 `iss: "wrong"` 的 token，确认被拒绝返回 401
- [x] 3.3 构造一个不含 `exp` 的 token，确认被拒绝返回 401
