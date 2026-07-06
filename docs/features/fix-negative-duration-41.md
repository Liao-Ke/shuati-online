# 修复：submit_answer 拒绝负耗时

**日期：** 见文件修改时间 &emsp; **关联 Issue：** [#41](https://github.com/Liao-Ke/shuati-online/issues/41)

## 目标

修复 `POST /api/exam/{id}/answer` 接受负数 `time_spent_seconds` 的输入校验缺失。原实现将该值直接写入 `AnswerRecord.time_spent_seconds` 并累加到 `ExamRecord.duration_seconds`，导致考试总耗时、答题明细和统计出现负值。

## 问题

1. `AnswerSubmit.time_spent_seconds`（`schemas.py`）无最小值约束
2. 负数通过 API 入库，污染结果页、历史记录与统计
3. 属于 trust boundary 输入校验缺失，不能依赖前端保证

## 方案

在 Pydantic schema 边界用 `Field(ge=0)` 拒绝非负约束外的输入。负值在请求解析阶段即被拒为 422，不进入路由逻辑、不写库。零值合法（瞬时作答），正整数行为不变，向后兼容。

## 改动

| 文件 | 改动 |
|------|------|
| `schemas.py` | `AnswerSubmit.time_spent_seconds` 由 `int` 改为 `int = Field(ge=0)`；导入补充 `Field` |
| `test_integration.py` | 新增 `test_50_submit_answer_rejects_negative_duration`，校验负耗时返回 422、零耗时正常入库、考试总耗时非负 |

## 影响范围

- 仅 `POST /api/exam/{id}/answer` 请求边界
- 零值与正整数行为完全不变，向后兼容
- 不涉及数据库、其他路由或前端

## 验证方式

1. `ruff check .` — 0 错误
2. `pytest test_integration.py -v` — 73 项全部通过（含新增 test_50）
3. 新增测试覆盖：负耗时 → 422，零耗时 → 200，`duration_seconds >= 0`
