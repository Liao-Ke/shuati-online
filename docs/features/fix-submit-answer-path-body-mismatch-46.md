# 修复 submit_answer 路径与请求体 exam_id 不一致时仍写入答案

**日期：** 2026-07-04  &emsp; **关联 Issue：** [#46](https://github.com/Liao-Ke/shuati-online/issues/46)

## 目标

`POST /api/exam/{exam_id}/answer` 路径中含 `exam_id`，但 `submit_answer` 未接收路径参数，实际查询使用请求体 `data.exam_id`。客户端请求路径 `/api/exam/A/answer`、请求体传 `exam_id=B` 时，答案会被写入考试 B，路径 A 被完全忽略，破坏 REST 路径语义并可能把答案提交到另一场考试。

## 修改范围

- `routers/exam.py`：`submit_answer` 函数签名新增 `exam_id: int` 路径参数，并在入口校验 `exam_id == data.exam_id`，不一致时返回 400
- `test_integration.py`：新增 `test_50_submit_answer_path_body_mismatch`，覆盖不一致→400、一致→200、不一致时答案不写入

## 核心实现

遵循本文件其他路由（`current_question`、`exam_result` 等）已有的路径参数约定，在 `submit_answer` 签名中加入 `exam_id: int`，并作为信任边界第一步校验：

```python
if exam_id != data.exam_id:
    raise HTTPException(status_code=400, detail="路径 exam_id 与请求体 exam_id 不一致")
```

校验在任何数据库查询之前触发，路径/请求体不一致时直接拒绝，不会读取或写入任何考试记录。

## 影响范围

- 仅 `POST /api/exam/{exam_id}/answer` 请求边界
- 前端 `api.submitAnswer` 已在路径与请求体中传同一个 `examId`，行为完全不变，向后兼容
- 不涉及数据库、其他路由或前端

## 验证方式

1. `ruff check .` 通过
2. `pytest test_integration.py` 73 项全部通过（含新增 1 项）
3. 红绿验证：临时还原修复后新测试失败、应用修复后通过

## 已知限制

- 保留了请求体中的 `exam_id` 字段以维持向后兼容，未采用 issue 中"移除 body 字段"的更激进方案，避免对已发版客户端造成破坏性变更
