# 修复：外键列补索引，删除主键 id 冗余索引（issue #137）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #137

## 问题

两个互相关联的缺陷：

1. **文档漂移**：`docs/db/schema.md` 声称的 5 条外键索引在 models.py、迁移和
   真实库中全都不存在。
2. **索引配置反了**：6 个 `index=True` 全部加在 `id` 主键上——SQLite 的
   `INTEGER PRIMARY KEY` 即 rowid 别名，二级索引永远不被查询计划选中，纯属
   写放大；而参与 join/filter 的 6 个外键列零索引，热点查询（按题库列题、
   提交答案定位单题、历史列表等）全表扫。

## 修改范围

- `models.py`：`index=True` 从 6 个 id 主键挪到 6 个外键列
  （`question_banks.user_id`、`questions.bank_id`、`exam_records.user_id`、
  `answer_records.exam_id`、`answer_records.question_id`、
  `review_records.question_id`）。`review_records.user_id` 由联合唯一约束
  前导列覆盖不单独加；`username` 唯一索引不动。
- 新迁移 `a1f7c2d3e4b5`：`CREATE INDEX` 6 条外键索引（命名与 models.py 的
  `ix_<表>_<列>` 约定一致）+ `DROP INDEX` 6 条主键冗余索引；downgrade 完整逆向。
- `docs/db/schema.md`：原虚假声明落地为真；补 review_records 索引小节；
  设计决策新增「索引布局」小节记录判据。
- `test_migration.py`：新增 `test_137_...`（head 索引全集断言 + EXPLAIN 走索引
  + downgrade 回滚断言）；原 #131 测试的两处适配（id 索引断言改外键索引；
  downgrade 目标从 `-1` 改显式版本号，因 head 已后移）。

## 验证方式

```bash
/home/Lsk/miniconda3/bin/python -m pytest -q   # 162 passed（迁移 8 项全过）
ruff check .                                    # All checks passed
```

- **双轨一致性**：create_all 建的新库与 alembic 升级库的索引集合实测完全相同
  （7 条：6 外键 + username）。
- **真实数据兼容**：开发库副本（3183 题/605 库）升级无报错，
  `integrity_check` ok、`foreign_key_check` 空，
  `answer_records WHERE exam_id=?` 查询计划从 SCAN 变为
  `SEARCH ... USING INDEX ix_answer_records_exam_id`。
- **回滚**：downgrade 恢复原索引布局（测试断言覆盖）。

## 已知限制

- 未做迁移前后的毫秒级性能基准（issue 内已有 2.9x–5.5x 实测数据，本次以
  EXPLAIN QUERY PLAN 的 SCAN→SEARCH 翻转为准）。
- 写放大变化：删 6 建 6，索引总数不变，写入成本从「维护 6 个无用索引」变为
  「维护 6 个有效索引」，净收益为正。
