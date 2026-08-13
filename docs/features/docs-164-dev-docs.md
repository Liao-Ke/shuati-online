# 文档：开发者文档过时内容整治（issue #164）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #164

## 逐项处理

**AGENTS.md：**
- SECRET_KEY：配置表与关键约束两处删除「硬编码默认值」的失实描述，改为
  #8 后实况（无默认值，缺省自动生成持久化到 `.secret_key`，生产必须显式设置）。
- 题型：choice/fill/judge「三种」→ 四种（含 multiple）。
- 项目结构：routers 列表补 `questions.py`/`limiter.py`；设计文档路径改
  `docs/designs/`；补 `tests/frontend/` 与 docs 子目录；features/ 双位置
  并存注明见 #169。
- 测试章节：改目录收集（#138 教训）+ 三个后端测试文件 + 前端测试命令；
  修正「不需 httpx」（TestClient 基于 httpx，requirements 显式依赖）。

**docs/designs/development-guide.md（测试章节整体重写）：**
- 运行命令改 `pytest -v` 目录收集 + 单测独立运行 + 前端测试。
- 测试说明改 #140/#141/#142 后实况：隔离临时库、无顺序依赖、httpx 必装。
- 编写规范：删除「模块级 State 共享」示范（#142 已移除的反模式，显式标注
  勿再引入），改为现行 fixture 只读契约（bank_id 只读 / own_bank 突变 /
  _register_isolated_user 计数隔离）。
- 已知注意事项表：测试隔离行改隔离临时库实况。

**RULES.md：**
- 文件树补 conftest.py、test_auth.py、test_migration.py、pyproject.toml、
  tests/frontend/；alembic/versions 补齐 4 个迁移文件。

## 验证方式

纯文档变更；逐项对照代码/文件系统核实（auth.py、routers/、tests/、
alembic/versions/、requirements.txt）。

## 已知限制

- schema.md 索引失实由 #137（PR #186）单独处理；features/ 双位置与
  RULES/AGENTS 规范矛盾由 #169 单独跟踪；本次不扩大。
- development-guide.md 的 bcrypt 排障命令版本号由 PR #173（#148）调整。
