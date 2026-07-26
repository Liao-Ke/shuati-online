# CI 修复：pytest 改为目录收集，补上被漏跑的 test_auth.py（issue #138）

## 背景

`.github/workflows/ci.yml` 的 test job 用显式文件名跑 pytest，只列了 `test_integration.py` 和 `test_migration.py`。`test_auth.py`（PR #38 引入）从未被任何 CI 步骤执行，其 4 个测试是 issue #8「SECRET_KEY 持久化」修复的回归防线。显式点名的写法让每次新增测试文件都依赖人工记得改 ci.yml，历史上 2 次新增已漏 1 次。

## 修改范围

仅 `ci.yml`：两条显式 pytest 合并为一条 `pytest -v` 目录收集，新增 `test_*.py` 自动纳入。保留迁移测试与 create_all 路径差异的注释（issue #131）。零业务代码改动。

## 验证

- 本地 `pytest --collect-only -q`：目录收集 160 个（149 集成 + 7 迁移 + 4 auth），比 CI 原先实跑多出的正是 `test_auth.py` 的 4 个。
- 本地 `pytest -q`：160 passed。
- `.venv/` 等点开头目录被 pytest 默认 `norecursedirs` 排除，不会误收集。

## 已知限制

无。
