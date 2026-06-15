## Context

Python 3.12 正式弃用 `datetime.datetime.utcnow()`（返回 naive datetime 但暗示 UTC），推荐使用 `datetime.now(timezone.utc).replace(tzinfo=None)`。SQLite 不支持时区，存储 naive UTC 是标准实践。

## Goals / Non-Goals

**Goals:**
- 消除所有 `datetime.datetime.utcnow()` 调用
- 统一使用一个可复用的工具函数
- 不产生 `DeprecationWarning`

**Non-Goals:**
- 不切换为 SQLAlchemy 的 `func.now()`（需要改 default 类型，涉及数据库兼容性）
- 不更改任何列的数据类型

## Decisions

### 替换方式：项目级工具函数

- **选择**：`models.py` 顶部定义 `def utcnow()`，返回 `datetime.now(timezone.utc).replace(tzinfo=None)`，所有文件 import 使用
- **替代方案**：每个调用点内联 — 代码重复，且未来换 `datetime.UTC`（3.11+别名）时需改多处
- **理由**：单一定义点，未来迁移到 `TIMESTAMPTZ`（如换 PostgreSQL）只需改一处

### 不改为 func.now()

- **选择**：保持 Python 端生成时间戳
- **替代方案**：`Column(DateTime, default=func.now())` — 由数据库生成
- **理由**：SQLite 的 `func.now()` 映射为 `CURRENT_TIMESTAMP`，格式依赖 SQLite 版本。Python 端生成更可控；且 `onupdate` 需要数据库触发器才能在 SQLite 上工作，改为 Python 端 `utcnow` 保持一致

## Risks / Trade-offs

- **[时钟依赖应用服务器]** 时间由 Python 生成，依赖服务器时钟准确性 → 容器化部署通常通过 NTP 同步，风险低
- **[import 循环]** 如果 router 从 `models` import `utcnow`，需确保 `models.py` 不反过来 import router → 当前 `models.py` 无此类依赖，安全
