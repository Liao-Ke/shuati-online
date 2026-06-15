## Why

当前项目使用 `Base.metadata.create_all(bind=engine)` 在启动时自动建表。这只适用于空数据库初始化，无法处理已有数据的表结构变更（如新增列、修改类型）。随着项目演进，需要数据库迁移工具管理 schema 版本。

## What Changes

- 安装 `alembic` 依赖
- 执行 `alembic init alembic` 初始化迁移目录
- 配置 `alembic/env.py` 引用项目的 `Base.metadata` 和 `SQLALCHEMY_DATABASE_URL`
- 生成初始迁移 `alembic revision --autogenerate -m "initial schema"`
- `Dockerfile` CMD 改为 `alembic upgrade head && uvicorn ...`
- `main.py` 保留 `create_all` 作为开发便利，但添加日志提示生产环境应用迁移

## Capabilities

### New Capabilities

- `alembic-setup`: Alembic 迁移工具集成，支持 autogenerate 和版本管理
- `docker-auto-migrate`: Docker 部署自动执行 `alembic upgrade head`

### Modified Capabilities

<!-- 无 -->

## Impact

- `requirements.txt`：新增 `alembic`
- `alembic/`：新建迁移目录（含 `env.py`、`alembic.ini`、`versions/`）
- `Dockerfile`：CMD 前追加迁移步骤
- `main.py`：保留 create_all + 加日志提示
