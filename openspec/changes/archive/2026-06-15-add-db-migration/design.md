## Context

项目当前在 `main.py` 启动时调用 `Base.metadata.create_all(bind=engine)` 自动建表。这只支持"从零创建"，不支持增量迁移（如后续加列、改索引）。SQLAlchemy 社区标准方案是 Alembic。

## Goals / Non-Goals

**Goals:**
- 初始化 Alembic，连接到本项目的 `Base.metadata`
- 生成当前 schema 的初始迁移
- Docker 启动自动执行迁移
- 保留 `create_all` 作为开发便利

**Non-Goals:**
- 不做数据库引擎迁移（SQLite→PostgreSQL）
- 不修改任何模型（仅生成当前状态的迁移）
- 不创建降级脚本（初始迁移无需 downgrade）

## Decisions

### env.py 策略：直接引用 project 模块

- **选择**：`alembic/env.py` 内 `from database import Base, SQLALCHEMY_DATABASE_URL` + `from models import *`
- **替代方案**：在 env.py 中重新定义 metadata — 冗余且容易不同步
- **理由**：单体项目无循环依赖风险，直接导入最简洁

### Docker 入口：CMD 串联

- **选择**：`CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000`
- **替代方案**：entrypoint.sh 脚本 — 对一行命令过度设计
- **理由**：`&&` 保证迁移失败时不启动应用

### 保留 create_all

- **选择**：保留 `create_all` 在 `main.py`，添加 `logger.warning` 提示
- **理由**：开发者直接 `uvicorn main:app` 时不需要手动跑 alembic

## Risks / Trade-offs

- **[alembic.ini 中的数据库 URL 硬编码]** env.py 中已覆盖为动态读取，alembic.ini 的 `sqlalchemy.url` 仅作占位符
- **[初始迁移包含可能不存在的表]** 如果数据库已有表但无 alembic 版本记录 → `alembic stamp head` 可标记当前状态为已迁移
