# 集成 Alembic 数据库迁移

## 目标

引入 Alembic 管理数据库 schema 版本，替代仅靠 `Base.metadata.create_all` 的启动建表策略，支持后续增量迁移。

## 修改范围

- `requirements.txt`：新增 `alembic==1.14.1`
- `alembic/`：由 `alembic init` 生成 + 手动配置的迁移目录
  - `alembic/env.py`：配置为引用项目的 `Base.metadata` 和 `SQLALCHEMY_DATABASE_URL`
  - `alembic/versions/519b18b6e049_initial_schema.py`：基于空数据库 autogenerate 的初始迁移
- `alembic.ini`：由 `alembic init` 生成（URL 占位，env.py 覆盖）
- `Dockerfile`：CMD 改为 `alembic upgrade head && uvicorn ...`
- `main.py`：将 `setup_logging()` 移到 `create_all` 之前，`create_all` 后添加 logger.warning 提示生产环境使用 alembic

## 核心实现

```python
# alembic/env.py
from database import Base, SQLALCHEMY_DATABASE_URL
import models
config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)
target_metadata = Base.metadata
```

Docker 入口链式执行：
```dockerfile
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000
```

## 影响范围

- 开发环境：`uvicorn main:app` 仍通过 `create_all` 建表（保留开发便利）
- Docker 部署：启动时自动执行 `alembic upgrade head`，迁移失败则应用不启动
- requirements.txt 新增 1 个依赖

## 验证方式

1. 删除 exam.db → `alembic upgrade head` 重建全部表 ✓
2. `pytest test_integration.py -v` 48/48 通过 ✓
3. 再次 `alembic upgrade head` 幂等无错误 ✓

## 已知限制

- 初始迁移在 `alembic init` 执行后生成，迁移 version ID 是 `519b18b6e049`
- 如果开发中已有数据库但无 alembic 版本记录，需要执行 `alembic stamp head` 标记已迁移
