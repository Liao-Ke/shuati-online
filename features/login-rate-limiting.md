# 登录接口速率限制

## 目标

防止暴力破解密码攻击。`POST /api/auth/login` 接口按客户端 IP 限流，每分钟最多 5 次请求。

## 修改范围

| 文件 | 修改内容 |
|------|---------|
| `requirements.txt` | 新增 `slowapi==0.1.9` |
| `routers/limiter.py` | 新建，创建共享 `Limiter` 实例（`key_func=get_remote_address`） |
| `main.py` | 注册 limiter 到 `app.state`，添加 `RateLimitExceeded` 异常处理器 |
| `routers/auth.py` | `login` 端点添加 `@limiter.limit("5/minute")` 装饰器和 `request: Request` 参数 |

## 核心实现

- **限流库**: `slowapi`（内存存储，无需 Redis）
- **限流策略**: `5/minute`（5 次/分钟/每 IP）
- **粒度**: 按客户端 IP（`get_remote_address`）
- **模块结构**: 新建 `routers/limiter.py` 避免 `main.py` 与 `routers/auth.py` 之间的循环引用

## 影响范围

- 仅影响 `POST /api/auth/login` 端点
- 注册、查询等其他端点不受影响
- 服务重启后计数清零（内存存储特性）

## 验证方式

```bash
pytest test_integration.py -v
# 48 passed，限流不影响正常测试流程

# 手动验证（使用 TestClient）：
# 连续 6 次错误登录，前 5 次返回 401，第 6 次返回 429
```

## 已知限制

- 单容器部署下有效，多实例需引入 Redis 共享状态
- 代理（Nginx 等）下游需配置 `proxy_headers=True`
