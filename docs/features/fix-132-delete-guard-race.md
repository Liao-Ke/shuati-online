# 修复删除保护 check-then-act 竞态：开考与删题/删库纳入 BEGIN IMMEDIATE 写事务（issue #132）

## 背景

#19 的删除保护（`routers/questions.py::delete_question`、`routers/banks.py::delete_bank`）承诺「进行中的考试不会丢失其引用的题目/题库」。守卫实现是 check-then-act：

1. 查询 `status == "in_progress"` 的考试，判断待删 id 是否在 `question_ids` / `bank_ids` 快照中；
2. 通过后删除并提交。

根因：**pysqlite 方言的 `do_begin` 不发语句**（`sqlalchemy/engine/default.py` 中为 `pass`），SQLite 事务实际由 sqlite3 驱动 legacy 隐式 BEGIN 管理——**SELECT 在事务外执行（语句级读锁），只有 DML 才隐式开事务**。因此删除侧的「读守卫」与「删除」、开考侧的「读题目列表」与「写快照」各自不构成一个持锁的整体：

- 并发 `POST /api/exam/start`（或 `wrong-answers/start`）在删除守卫读到「无引用」之后、删除提交之前写入快照 → 产出「in_progress 考试引用已删题目」状态；
- 反之，开考侧读到旧题目列表后，删除先完成 → 快照引用已删题目。

安全影响已被 #123 / PR #130 中和（取题路径复核归属），残留的是完整性/并发正确性问题，也是 #84 根因链的一环。

## 方案

Issue 内三个候选方案中采纳 owner 评论推荐的「**删除与开考两侧均在 BEGIN IMMEDIATE 写事务内完成校验+写入**」：

- SQLite 的 `BEGIN IMMEDIATE` 在事务起步即获取 RESERVED 写锁，所有写者完全串行化；
- 开考侧整个「读题目 → 写快照 → 提交」都在写事务内：删除侧只能等其提交后再拿锁，此时守卫复查能看到该考试 → 409；反之删除先完成时，开考侧在写锁保护下读不到已删题目 → 400。窗口闭合，且**不需要在代码里加任何额外复查**——两侧读到的都是写锁保护下的最新状态。

实现上未采用 SQLAlchemy `isolation_level` 参数（本机 2.0.36 的 SQLite 方言 `_isolation_lookup` 仅含 READ UNCOMMITTED / SERIALIZABLE，不支持 `"IMMEDIATE"`），而是利用 pysqlite「事务靠驱动隐式管理」的特性，在写事务依赖里对驱动层显式执行 `BEGIN IMMEDIATE`：sqlite3 检测到 `in_transaction` 后不会重复隐式 BEGIN，`db.commit()` / 回滚仍由 Session 照常发出，路由代码零改动。

## 修改文件

- `database.py`：新增 `get_write_db` 依赖（`SessionLocal` + 驱动层 `BEGIN IMMEDIATE`，注释说明根因）。
- `routers/questions.py`：`delete_question` 改用 `get_write_db`。
- `routers/banks.py`：`delete_bank` 改用 `get_write_db`。
- `routers/exam.py`：`start_exam` 改用 `get_write_db`。
- `routers/wrong_answers.py`：`start_wrong_answer_practice` 改用 `get_write_db`。
- `test_integration.py`：新增 4 个回归测试（见下）。

## 验证

- `test_132_write_routes_begin_immediate`：engine `before_cursor_execute` 事件捕获语句，断言 `exam/start` 与 `wrong-answers/start` 两个写事务都真实发出 `BEGIN IMMEDIATE`。已做有效性验证：临时禁用 `BEGIN IMMEDIATE` 后该测试确定性失败，恢复后通过。
- `test_132_concurrent_delete_question_vs_start` / `test_132_concurrent_delete_bank_vs_start`：各自 10 轮 Barrier 同步并发「删除 vs 开考」，断言删除只返回 204/409、开考只返回 200/400，且库中不存在引用已删 id 的 in_progress 考试。
- `test_132_concurrent_delete_question_vs_wrong_start`：5 轮并发「删题 vs 错题练习开考」（先答错并完成考试生成错题），同样断言无悬垂快照。
- 全量回归：`pytest -v` 165 passed（含 `test_migration.py`、`test_auth.py`）；`ruff check .` 通过。
- 独立脚本验证（已清理）：BEGIN IMMEDIATE 事务持锁期间另一连接写入被阻塞（`database is locked`），证明写锁互斥生效。

## 已知限制与后续

- `update_question`（`routers/questions.py`，#90 编辑保护）是同一 check-then-act 模式：并发开考可绕过「进行中考试的题目不可编辑」守卫，导致考试快照指向已被修改判分标准的题目。不在本次 issue 范围内未改；后续可同样改用 `get_write_db` 闭合（一行依赖替换）。
- `BEGIN IMMEDIATE` 使写路由在持锁期间与其他长读事务互斥，默认 busy timeout 5s；当前所有读路由均为毫秒级短查询，无实际影响。若未来引入长事务读（如报表导出），需评估。
- 普通读路由（`get_db`）保持 legacy 隐式事务行为不变，未扩大改动面。
