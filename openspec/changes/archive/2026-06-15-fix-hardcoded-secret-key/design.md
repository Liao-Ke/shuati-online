## Context

`auth.py` 当前在模块顶层执行 `os.getenv("SECRET_KEY", "exam-platform-secret-key-change-in-production")`。这导致：开发者和 CI 不会意识到 key 需要配置；Docker Compose 部署时静默使用默认值。

## Goals / Non-Goals

**Goals:**
- 消除所有硬编码默认密钥
- 生产部署遗漏配置时立即失败（fail-fast）
- 开发环境零配置可用

**Non-Goals:**
- 不引入密钥轮换机制
- 不引入外部密钥管理服务（Vault 等）

## Decisions

### 开发环境 fallback：secrets.token_hex(32)

- **选择**：`os.getenv("SECRET_KEY") or secrets.token_hex(32)`
- **替代方案**：仅读环境变量，未设置时 `sys.exit(1)` — 影响开发体验
- **理由**：开发环境自动生成不影响开发流程；`secrets` 模块是 CPython 标准库，无额外依赖

### Docker Compose 校验：`:?` 语法

- **选择**：`${SECRET_KEY:?SECRET_KEY must be set for production}`
- **理由**：Docker Compose 原生支持的变量校验，无需额外脚本

## Risks / Trade-offs

- **[重启 key 变化]** 开发环境每次重启 `secrets.token_hex()` 生成新 key，已有 token 全部失效 → 开发环境无持久用户，可接受
- **[未加 `iss` 校验]** 不影响，本提案仅改 key 生成，JWT 加强在 `harden-jwt-validation` 提案中单独处理
