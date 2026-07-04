# 修复 背题页"只看需复习"返回未标记题目

**日期：** 2026-07-04  &emsp; **关联 Issue：** [#47](https://github.com/Liao-Ke/shuati-online/issues/47)

## 目标

`POST /api/review/questions` 的 `show_reviewing_only` 过滤语义为"只看需复习"，但原实现只排除 `known` 题，未标记题（`review_status = null`）仍会混入结果，与文案不一致。

## 修改范围

- `routers/review.py`：`get_review_questions` 的过滤条件由 `status == "known"` 改为 `status != "reviewing"`
- `test_integration.py`：新增 `test_26a_filter_reviewing_only_excludes_unmarked`，校验只返回 `reviewing` 题，`known` 与未标记题均被排除

## 核心实现

当 `show_reviewing_only = true` 时，仅保留 `review_status == "reviewing"` 的题目；`known` 与 `null`（未标记）一律跳过。一行条件改动，向后兼容（`show_reviewing_only = false` 行为不变）。

## 影响范围

- 仅 `POST /api/review/questions` 接口的过滤分支
- 不涉及数据库、其他路由或前端

## 验证方式

1. `ruff check .` 通过
2. `pytest test_integration.py` 73 项全部通过（含新增 1 项）
3. 红绿验证：临时还原修复后新测试失败、应用修复后通过

## 已知限制

- 无
