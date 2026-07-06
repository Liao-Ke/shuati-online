# 修复缺失 Authorization 头返回 403（issue #56）

## 背景

接口文档约定认证失败返回 `401`。原实现使用 `HTTPBearer()` 默认行为，缺失 `Authorization` 头或认证 scheme 不匹配时会在进入业务认证逻辑前返回 `403 Not authenticated`，与无效 token 的 `401` 不一致。

## 修改范围

- 将认证依赖调整为 `HTTPBearer(auto_error=False)`。
- 在 `get_current_user()` 中统一处理 `credentials is None`，返回 `401` 和中文错误信息 `未认证`。
- 保持无效 token、用户不存在等已有 `401` 行为不变。

## 验证

- 新增集成测试覆盖缺失 `Authorization` 头返回 `401`。
- 新增集成测试覆盖非 `Bearer` scheme 返回 `401`。
- 本地执行 `ruff check --no-cache auth.py test_integration.py`。
- 本地执行 Python AST 语法检查。
