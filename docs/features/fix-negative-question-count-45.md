# 修复 start_exam 接受负数 question_count 导致服务端 ValueError/500

**日期：** 2026-07-04  &emsp; **关联 Issue：** [#45](https://github.com/Liao-Ke/shuati-online/issues/45)

## 目标

`POST /api/exam/start` 的 `ExamStart.question_count` 缺少下限校验。传入负数时进入抽题分支，调用 `random.Random(seed).sample(questions, -1)` 抛出 `ValueError`，表现为服务端 500；传入 0 时静默使用全部题目，与字段语义不符。期望在请求边界拒绝 0 和负数，仅接受 `None`（用全部题目）或正整数。

## 修改范围

- `schemas.py`：`ExamStart.question_count` 由 `int | None = None` 改为 `int | None = Field(default=None, ge=1)`，并补充 `Field` 导入
- `test_integration.py`：新增 `test_04a_start_exam_rejects_nonpositive_count`，校验 0/-1 返回 422

## 核心实现

利用 Pydantic v2 的数值约束：`Optional[int]` 字段为 `None` 时跳过约束，传入具体数值时校验 `ge=1`。因此 `None`（用全部题目）行为不变，`0` 和负数在请求解析阶段即被拒绝为 422，错误信息为 `Input should be greater than or equal to 1`，不再进入 `start_exam` 路由逻辑。

## 影响范围

- 仅 `POST /api/exam/start` 请求边界
- `None` 与正整数行为完全不变，向后兼容
- 不涉及数据库、其他路由或前端

## 验证方式

1. `ruff check .` 通过
2. `pytest test_integration.py` 73 项全部通过（含新增 1 项）
3. TestClient 真实 HTTP 路径复现：`question_count=-1`/`0` → 422，`question_count=1` → 200

## 已知限制

- 无
