## 1. 代码修改

- [x] 1.1 修改 `auth.py`：删除硬编码默认值 `"exam-platform-secret-key-change-in-production"`，改为 `import secrets` + `_SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)` + `SECRET_KEY = _SECRET_KEY`

## 2. Docker 配置

- [x] 2.1 修改 `docker-compose.yml`：在 `environment` 段添加 `SECRET_KEY=${SECRET_KEY:?SECRET_KEY must be set for production}`

## 3. 验证

- [x] 3.1 不带 `SECRET_KEY` 环境变量启动 `docker compose up`，确认报错退出
- [x] 3.2 带 `SECRET_KEY=test-key-xxx` 启动，确认正常
- [x] 3.3 运行 `pytest test_integration.py -v`，确认认证流程不受影响
