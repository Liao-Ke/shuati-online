# 修复：create_all/alembic 双轨的两个失败模式防护（issue #136）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #136

## 问题

`create_all` 与 alembic 互不感知，两个坑：

- **坑 a**：create_all 建的库没有 `alembic_version`，之后 `alembic upgrade head`
  撞已存在的表直接崩溃且无法自愈（只能人工 stamp）。
- **坑 b**：拉新代码没跑迁移的部署静默沿用旧 schema，零告警——#131 这类
  安全修复的失效是静默的。本地部署文档的首次部署步骤也不含迁移命令。

## 修复（按 issue 限定范围，三步）

1. `main.py` 新增 `_sync_schema_version(fresh_db)`：
   - create_all 建出**全新库**（建表前 inspect 无 users 表）→ 立即 stamp 到
     head，坑 a 从源头消除；
   - 存量库版本落后 → `logger.error`「当前 X / 期望 Y，请执行 alembic upgrade head」；
   - 有表但无版本号（历史坑 a 库）→ `logger.error` 提示 `alembic stamp head`
     （并说明直接 upgrade 会撞表）。
   - 实现直接用 `MigrationContext` 读写版本，不经 alembic command/env.py
     （其 fileConfig 会重配应用日志）。
2. `test_migration.py` 新增 2 用例：全新库 import main 后带版本号且
   `alembic upgrade head` 干净通过（坑 a 根除验证）；落后库启动输出含
   「schema 版本落后」告警（坑 b）。
3. `docs/deploy/guide.md` §方式二插入「初始化/更新数据库 schema」步骤
   （`alembic upgrade head`），与 §升级 对齐。

## 验证方式

```bash
/home/Lsk/miniconda3/bin/python -m pytest -q   # 163 passed（迁移 9 项）
ruff check .                                    # All checks passed
```

已红-绿验证：还原 main.py 后两用例均失败（新库无 alembic_version 表 / 无告警）。
集成测试（conftest 临时库）经 create_all + stamp 路径全绿，行为无回归。

## 已知限制

- 本仓库现有 exam.db 的悬空 revision 属历史遗留，issue 明确不在修复范围。
- 多分支共用本地库的版本漂移（issue 提到的第三摩擦点）未处理，属独立议题。
