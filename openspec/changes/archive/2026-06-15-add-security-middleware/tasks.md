## 1. 代码修改

- [x] 1.1 修改 `main.py`：导入 `CORSMiddleware` 和 `TrustedHostMiddleware`
- [x] 1.2 在 `app = FastAPI(...)` 之后、路由注册之前，添加 `CORSMiddleware`：`allow_origins` 从 `CORS_ORIGINS` 环境变量读取（split by comma），默认 `["*"]`；`allow_credentials=True`；`allow_methods=["*"]`；`allow_headers=["*"]`
- [x] 1.3 添加 `TrustedHostMiddleware`：`allowed_hosts` 从 `ALLOWED_HOSTS` 环境变量读取，默认 `["*"]`

## 2. 验证

- [x] 2.1 启动应用，`curl -v localhost:8000/api/health`，确认响应头包含 CORS 相关头
- [x] 2.2 设置 `ALLOWED_HOSTS=myapp.com`，`curl -H "Host: evil.com" localhost:8000/api/health`，确认返回 400
- [x] 2.3 运行 `pytest test_integration.py -v`，确认无回归
