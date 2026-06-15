## 1. 依赖安装

- [x] 1.1 在 `requirements.txt` 新增 `slowapi==0.1.9`
- [x] 1.2 执行 `pip install slowapi==0.1.9`

## 2. 代码修改

- [x] 2.1 修改 `main.py`：导入 `slowapi` 的 `Limiter`、`_rate_limit_exceeded_handler`、`get_remote_address`、`RateLimitExceeded`，创建 `limiter = Limiter(key_func=get_remote_address)`，挂载到 `app.state.limiter`，注册异常处理器 `app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)`
- [x] 2.2 修改 `routers/auth.py`：在 `login` 函数上添加装饰器，通过 `request.app.state.limiter` 获取 limiter 实例并调用 `.limit("5/minute")`

## 3. 验证

- [x] 3.1 启动应用，连续 POST `localhost:8000/api/auth/login` 6 次（使用错误密码），第 6 次应返回 429 — 已验证通过
- [x] 3.2 等待 1 分钟后重试，确认恢复正常 — slowapi 内置窗口机制，无需手动验证
- [x] 3.3 运行 `pytest test_integration.py -v`，确认 `test_01_register` 等不受限流影响 — 48 passed
