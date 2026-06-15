## Context

项目无日志系统。生产问题排查只能靠 HTTP 响应状态码猜测。容器化部署下 stdout 日志是标准实践——Docker/podman 自动收集，无需文件轮转管理。

## Goals / Non-Goals

**Goals:**
- 统一的 logger 命名空间（`"shuati"`）
- stdout 输出，格式：`时间 [级别] 模块 - 消息`
- 关键操作（认证、考试、题库管理）有日志记录
- 抑制第三方库噪音（SQLAlchemy 引擎、passlib）

**Non-Goals:**
- 不做文件日志轮转
- 不接入外部日志聚合（ELK/Loki）
- 不记录请求/响应体（隐私风险）

## Decisions

### 输出目标：stdout vs 文件

- **选择**：`StreamHandler(sys.stdout)`，无文件日志
- **理由**：容器化部署标准。Docker logs / podman logs 自动收集，log rotation 由容器运行时管理

### 日志级别：第三方库 WARNING

- **选择**：`logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)`
- **理由**：默认 INFO 会打印每条 SQL，极大量噪声。DEBUG 调试时手动改级别即可

### Logger 名称：`"shuati"` vs `__name__`

- **选择**：顶层 `setup_logging()` 返回 `logging.getLogger("shuati")`，各模块 `logger = logging.getLogger("shuati")`
- **替代方案**：`logging.getLogger(__name__)` 产生层级 logger（`routers.auth`、`routers.exam` 等）
- **理由**：项目规模小（8 个模块），不需要细粒度 logger 层级。统一命名空间足够

### 日志内容：记录 username 不记录 password

- **选择**：`logger.info(f"用户 {data.username} 登录成功")`
- **理由**：任何情况下不记录明文密码或 token

## Risks / Trade-offs

- **[日志量]** 高峰时日志可能较多 → 当前单用户/小团队使用，可忽略。未来如需要可加采样
- **[stdout 阻塞]** 同步 logging 在高并发时可能阻塞 → 当前 SQLite 单写瓶颈远大于日志瓶颈
