# 修复：批量导入事务原子性

**日期：** 见文件修改时间 &emsp; **关联 Issue：** [#10](https://github.com/Liao-Ke/shuati-online/issues/10)

## 目标

修复 `POST /api/question-banks/import-multiple` 批量导入接口的事务原子性问题。原实现在循环中逐个 commit，部分失败后已成功的导入无法回滚，Session 状态不可靠。

## 问题

1. 每个导入立即 `commit()`，失败无法回滚已成功的导入
2. `db.rollback()` 只回滚当前失败事务，Session 状态可能被污染
3. 后续导入在不确定的 Session 状态下执行

## 方案

采用 **savepoint 隔离**：每个导入用 `db.begin_nested()` 包裹，失败的单独回滚 savepoint，成功的保留，循环结束后统一 commit。

## 改动

| 文件 | 改动 |
|------|------|
| `routers/banks.py` `_do_import_one` | 移除 `db.commit()`，改为 `db.flush()`，由调用方控制提交时机 |
| `routers/banks.py` `import_bank` | 调用 `_do_import_one` 后补 `db.commit()` |
| `routers/banks.py` `import_banks_multiple` | 每个导入用 savepoint 包裹，循环结束后统一 commit |
| `test_integration.py` | 新增 `test_03c_import_multiple_db_failure`，用 mock 模拟 DB 异常验证事务隔离 |

## 验证方式

1. `ruff check .` — 0 错误
2. `pytest test_integration.py -v` — 67 项全部通过（含新增 test_03c）
3. 新增测试验证：中间项 DB 异常时，前后项成功入库，失败项不入库
