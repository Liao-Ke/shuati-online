# 修复：错题练习 timer_mode 枚举校验

**日期：** 见文件修改时间 &emsp; **关联 Issue：** [#48](https://github.com/Liao-Ke/shuati-online/issues/48)

## 目标

补齐 `POST /api/wrong-answers/start` 的 `timer_mode` 枚举校验，与 `POST /api/exam/start`（#13 已修复）行为一致，防止非法计时模式落库后前端进入未定义状态。

## 问题

`WrongAnswerStartRequest.timer_mode`（`schemas.py`）只是普通字符串，默认 `per_question`，无枚举校验。直接调用 API 传 `timer_mode = "bad_mode"` 时接口仍返回 200 并创建 `ExamRecord`，前端只认识 `per_question` / `elapsed`，非法值导致计时行为不可预期。

## 方案

复用 `ExamStart` 已有的 `@field_validator("timer_mode")` 模式，在 `WrongAnswerStartRequest` 上加同款校验：值不在 `("per_question", "elapsed")` 时抛 `ValueError`，Pydantic 在请求解析阶段返回 422，不进入路由逻辑。`per_question`、`elapsed` 与默认值行为完全不变，向后兼容。

## 改动

| 文件 | 改动 |
|------|------|
| `schemas.py` `WrongAnswerStartRequest` | 新增 `@field_validator("timer_mode")`，仅允许 `per_question` / `elapsed` |
| `test_integration.py` | 新增 `test_07g_wrong_practice_rejects_invalid_timer_mode`：非法值 → 422，`elapsed` → 200 |

## 验证方式

1. `ruff check .` — 0 错误
2. `pytest test_integration.py -v` — 全部通过（含新增 test_07g）
3. 红绿验证：临时移除 validator 后新测试失败（`bad_mode` 不再 422），恢复后通过

## 影响范围

- 仅 `POST /api/wrong-answers/start` 请求边界
- 不涉及数据库、其他路由或前端
