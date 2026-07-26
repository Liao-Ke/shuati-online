# 根因加固：questions/question_banks 主键改 AUTOINCREMENT，根除 SQLite rowid 复用（issue #131）

## 背景

`questions` / `question_banks` 均为 SQLite `INTEGER PRIMARY KEY`（rowid 别名）无 `AUTOINCREMENT`，删除最高位行后下一次插入复用同一 id。「考试快照 / 答题记录里存的 id」与「id 指向的行」之间存在时间差，删除+复用即可让旧 id 重新指向他人（或另一道）题目——#84/#123/#125 三个安全 issue 的共同根因。此前的修复都是在读写取题路径逐处补 `QuestionBank.user_id` 归属校验消解影响（#123/PR #130 已收口成不变量），但任何未来新增的按存储 id 取行的代码都要记得再补一次校验，否则又是一个缺口。

## 修复范围

1. **主键改 AUTOINCREMENT（根因）**：`models.py` 给 `Question` / `QuestionBank` 加 `__table_args__ = {"sqlite_autoincrement": True}`；migration `3159d3fe4acc` 用 alembic batch 模式（反射现有列/索引/外键）重建两表搬迁数据。id 从此单调递增永不复用。
2. **sqlite_sequence 过种子**：迁移把序列种子顶到「历史上被引用过的最大 id」——扫描 `answer_records.question_id`、`review_records.question_id` 及 `exam_records.bank_ids`/`question_ids` 快照 JSON。否则迁移前已删除的高位 id（实测开发库存在：快照最大 question_id=2913 > 当前 max(id)=2911）仍会被复用一次。种子候选按 `SEED_MAX_GAP = 1_000_000` 钳制，理由见「审查发现」。
3. **外键强制（纵深防御）**：`database.py` 为应用 engine 挂 connect 事件执行 `PRAGMA foreign_keys=ON`。#123 安全审查 poc3 显示绕过 ORM 的原生 SQL 删除会留下悬垂 `answer_records.question_id`，复用后即泄露；开启后此类删除被直接拦截。监听器只挂 engine 实例，alembic 自建连接不受影响（batch 整表重建需要外键关闭）。
4. **不改其余四表**：判据是「id 是否被外部存储引用」而非「是否会被删除」——`users`/`exam_records`/`answer_records` 无删除路径；`review_records` 有级联删除、id 确实会复用，但没有任何快照、外键或接口响应保存它。
5. **保留 #123/#130 的归属校验**：根因消除后归属 join 退化为纵深防御，不移除。

## 修改文件

- `models.py`：两个模型加 `sqlite_autoincrement`，更新过时注释。
- `database.py`：SQLite 连接强制外键。
- `alembic/versions/3159d3fe4acc_pk_autoincrement_no_rowid_reuse.py`：新迁移（可回滚）。
- `test_migration.py`：新增，在临时库上真跑 alembic 覆盖迁移逻辑本身。
- `.github/workflows/ci.yml`：CI 增跑 `pytest test_migration.py`。
- `test_integration.py`：新增 2 个回归测试；改写 1 个、微调 1 个依赖复用行为的旧测试。
- `docs/db/schema.md`、`docs/deploy/guide.md`、`AGENTS.md`：同步文档（schema.md 原先误标所有表为 AUTO INCREMENT，一并修正）。

## 审查发现与二次修复

初版实现经 4 维度对抗性审查（每个发现 3 票独立复核），确认 4 项并全部修复：

1. **【高危，本次新引入】客户端可投毒序列种子**：`exam_records.bank_ids` 存的是 `start_exam` 原样落盘的 `data.bank_ids`（`routers/exam.py:118`，schema 仅 `list[int]` 无上界，即 issue #125）。初版把它直接当种子，任意注册用户开考时提交 `[自己的库id, 2**63-1]`，运维一执行 `alembic upgrade head`，此后**全站**建库/导入均报 `SQLITE_FULL`（实测 500，序列耗尽不自愈）。这是本分支把一个原本无害的读时脏数据提升为写路径控制值所致。修复：种子候选钳制在「可信来源最大 id + `SEED_MAX_GAP`」内；真实「已删除高位 id」与当前 max 的差距只有删除量级，一百万足够宽松，而多顶高一百万 id 无任何副作用。根因侧的 `bank_ids` 写入过滤属 #125/PR #129 范围，本分支不重复改动。
2. **【中】迁移中途失败后无法重试**：batch 模式的 `_alembic_tmp_*` 表在隐式事务前已 autocommit，失败（磁盘满/OOM/断电）时不随事务回滚，此后每次 `alembic upgrade head` 报 `table already exists`——配合 `Dockerfile` 的 `alembic upgrade head && uvicorn` 与 `restart: unless-stopped`，容器陷入需人工 `DROP TABLE` 才能恢复的 crash-loop。修复：upgrade/downgrade 开头幂等 `DROP TABLE IF EXISTS`。
3. **【中】「其余四表无删除路径」论据错误**：`review_records` 经 `Question.review_records` 的 delete-orphan 有删除路径，其 id 实测确实会复用。结论（不加 AUTOINCREMENT）正确，但理由须改为「无任何地方存储该 id」——本次修复的立论就是「存 id + 复用 = 缺口」，错误前提会让未来新增存 review 记录 id 的功能被误判为安全。已修正迁移 docstring 与 `docs/db/schema.md`。
4. **【中】迁移逻辑零自动化覆盖**：集成测试库由 `create_all` 建出、从不跑 alembic，即便 `upgrade()` 整个 return 也照样全绿——安全上最要紧的过种子一条断言都没有。修复：新增 `test_migration.py`（7 用例）并接入 CI。

## 验证

- 迁移在开发库真实数据副本上验证：升级后 DDL 含 `AUTOINCREMENT`、2784 题/522 库行数不变、索引保留、`PRAGMA foreign_key_check`/`integrity_check` 干净、`sqlite_sequence` 种子为 2913/525（正确覆盖快照里已删除的高位 id）；实测删除最高位题目后新插入拿到 2914，复用根除。
- `alembic downgrade -1` 回滚后 DDL/数据复原，重升级幂等；空库从零 `upgrade head` 与开发环境 `create_all` 两条建表路径 DDL 一致。
- `test_migration.py`（7 passed）覆盖：AUTOINCREMENT 与数据/索引/外键完整性、只存在于快照的已删除高位 id 过种子、投毒 `bank_ids` 被钳制且序列不耗尽、畸形快照 JSON 容错、`_alembic_tmp_*` 残留自愈、回滚复原、空库升级。
- 反向验证：分别撤销钳制 / 残留自愈 / 整个 `upgrade()`，对应用例失败（1、1、7 个），恢复后全绿——排除假绿。
- `test_131a_deleted_ids_never_reused`：纯 HTTP 删库重导入，断言题库/题目 id 严格递增。
- `test_131b_sqlite_enforces_foreign_keys`：应用连接 `PRAGMA foreign_keys=1`，原生 SQL 删除被引用题目抛 `IntegrityError`（poc3 回归）；ORM 删除路径不受影响。
- `test_123a` 原依赖「id 自然复用」构造攻击状态（前提断言在根因修复后必然失败），改写为直接伪造快照，与 `test_123b/c` 同口径；`test_25b` 退化为级联删除回归，仅改注释。
- `pytest test_integration.py test_auth.py test_migration.py`：155 passed——在全新库（CI 等价）与迁移后的存量数据副本上各跑一遍。
- `ruff check .` 通过。

## 已知限制

- 迁移未在生产前自动备份数据库文件；Docker 启动时自动执行，建议升级前手动备份 volume 中的 `exam.db`。表重建为整表复制，失败时业务数据与 `alembic_version` 都随事务回滚不损坏，残留的 `_alembic_tmp_*` 由下次重试自动清理。
- `AUTOINCREMENT` 使插入需维护 `sqlite_sequence`，有可忽略的写入开销（官方文档量级：每次插入多一次内部表更新）。
- 本地开发库若曾被其他分支的迁移 stamp 过（如带 `question_snapshot` 列的分支），`alembic_version` 指向本分支不存在的 revision，需先手动对齐版本号再升级。
- 非 SQLite 数据库（如未来迁 PostgreSQL）自增序列本就不复用，迁移对其为 no-op。
