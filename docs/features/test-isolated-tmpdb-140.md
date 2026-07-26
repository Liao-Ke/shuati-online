# 测试基础设施：集成测试改用隔离临时库（issue #140 第一步）

## 背景

`test_integration.py` 通过 `from main import app` 触发 `main.py` 的 `Base.metadata.create_all`，作用于 `database.py` 默认的 `sqlite:///./exam.db`——即工作目录的真实开发库。后果有二：

1. 每次本地跑测试都向开发库塞入测试用户和题库（实测 485 个用户全部为测试遗留、605 个题库中 476 个匹配测试模式）。
2. `create_all`（checkfirst）永不修改已存在的表，开发库 schema 落后迁移时测试在本地失败、CI（全新 checkout 无 exam.db）却全绿，产生「看似功能回归、实为环境滞后」的误导性失败（例：#131 合并后 `test_131a` 本地挂）。

## 修改范围

- 新增仓库根 `conftest.py`：在任何测试模块 import 前，用 `os.environ.setdefault` 把 `DATABASE_URL` 指向 `tempfile.mkdtemp` 建出的临时目录下的 `test.db`。pytest 保证根 conftest 先于测试模块 import，因此赋值早于 `database.py` 模块级的 `os.getenv`。
- 零测试改动、零业务代码改动。

## 设计取舍

- `setdefault` 而非直接赋值：CI 或开发者显式导出的 `DATABASE_URL` 仍然生效（已实测：显式传入的路径被使用）。
- session 级单临时库而非每测试一库：第二步去 State 化完成前，测试间本就依赖共享数据；单库是零改动前提下收益/成本比最高的切入点。
- 临时目录不在测试进程内清理：engine 生命周期与进程一致，目录交由操作系统回收（位于系统临时目录）。
- `test_migration.py` 不受影响：它每次调用 alembic 时用 `env={**os.environ, "DATABASE_URL": ...}` 显式覆盖，自管临时库。

## 验证

- `pytest test_integration.py test_auth.py test_migration.py`：166 passed。
- 全量运行前后 `./exam.db` 的 mtime 与 sha256 完全不变（测试不再触碰开发库）。
- `DATABASE_URL=sqlite:///<自定义路径>` 显式指定时，库文件落在指定路径，conftest 默认值被覆盖。
- `ruff check conftest.py` 通过。

## 已知限制

- 测试间共享状态（模块级 `State` 单例）仍在，单个测试仍不能独立运行——issue #140 第二步处理。
- 存量开发库中的历史测试数据不做清理，属于开发者本地数据，由开发者自行决定。
