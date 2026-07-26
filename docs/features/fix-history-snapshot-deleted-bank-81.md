# 修复：删除题库后历史详情丢失答案明细（issue #81）

**日期：** 2026-07-26  &emsp; **关联 Issue：** [#81](../../../../issues/81)

## 问题

删除题库会经 `QuestionBank.questions` 的 `delete-orphan` 级联删除题目；`exam_result` 回填历史明细时只按现存题目查询，题目已删则静默跳过。结果是历史列表仍显示总题数/正确数/错误数，但详情页 `answers` 为空或缺项——汇总与明细静默不一致。

## 方案

**答题快照**（issue 中三个候选方向由维护者选定）：作答时把题目内容固化进答题记录，历史详情不再依赖题目表存活。

- `models.py`：`AnswerRecord` 新增 `question_snapshot` Text 列，存作答时的题目 JSON（`type/chapter/content/options/correct_answer/analysis`，均为反序列化后的值）。
- `routers/exam.py` `submit_answer`：创建 `AnswerRecord` 时写入快照。
- `routers/exam.py` `exam_result`（`history_detail` 复用）：题目现存时行为不变；已删除时回退快照并附加 `question_deleted: true`；无快照的旧孤儿记录给占位文案「（题目已删除，仅保留作答记录）」，删除不再导致明细条数少于汇总数（提前交卷的未作答题目本就不生成明细，属 issue #22 既定设计，不在本次范围）。
- `alembic/versions/fc868b9a7b87`：加列 + 对题目尚存的存量答题记录回填快照；`downgrade` 直接删列。
- `static/js/app.js`：结果页与历史详情两段完全相同的渲染循环合并为 `renderAnswerReviewItem`，新增「题目已删除」徽标；`correct_answer` 为 null（旧孤儿记录）时隐藏正确答案行。

## 已有数据库升级

开发库若从未被 alembic 管理（无 `alembic_version` 表），`create_all` 不会给已有表加列，需手动执行：

```bash
alembic stamp afa1757b2ecd && alembic upgrade head
```

Docker 部署入口已有 `alembic upgrade head`，无需额外操作。

## 验证

- 迁移：在开发库副本上 `stamp → upgrade → downgrade → upgrade` 全通过；1717 条存量记录中题目尚存的 485 条全部回填，1232 条历史孤儿保持 null 走占位。
- 回归测试：`test_81a`（删除题库后明细经快照完整保留）、`test_81b`（无快照孤儿记录显示占位不跳过）；`pytest test_integration.py test_auth.py` 145 通过。

## 已知限制

- 快照是作答时的一次性固化，此后编辑题目不会同步到已有历史（符合「历史答卷」语义）。
- 快照上线前已删除题目的旧记录无法恢复内容，只能占位展示用户答案与对错。
- 存储上题目内容随每次作答冗余一份。ponytail: 未做去重/压缩，SQLite 单机场景冗余可接受；若未来数据量成为问题，可改为按 (question_id, 内容 hash) 归一化的快照表。
