# 修复：parse_json_list 统一防护损坏 JSON 快照的成员判断（issue #172）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #172（#146 修复过程中发现并建档）

## 问题

`parse_json_field` 解析失败原样返回字符串。4 处对返回值直接做成员判断/集合构造：

- `update_question` / `delete_question`（#90 检查）、`delete_bank`（#19 检查）：
  `int in str` → TypeError → 500。用户名下只要有一条损坏快照的进行中考试，
  就无法编辑/删除任何题目、无法删除任何题库。
- `submit_answer` 归属校验：`set(str)` 得字符集合，int 永远 not in → 合法提交
  误判 400。

仅 `_load_all_exam_questions` 有 isinstance 防护（#43）。

## 修复

- `utils.py` 新增 `parse_json_list(val) -> list`：非列表（含解析失败）一律回空列表，
  与 #43 读路径降级口径一致。
- 4 处调用点收口到该函数；`_load_all_exam_questions` 的手写 isinstance 防护
  一并统一（行为不变）。
- 降级语义：损坏快照的进行中考试不再阻断题目/题库管理（按无引用放行）；
  对损坏考试提交答案明确 400（与读路径「空考试」一致）。

## 验证方式

```bash
/home/Lsk/miniconda3/bin/python -m pytest -q   # 162 passed
ruff check .                                    # All checks passed
```

新增 `test_172_corrupt_snapshot_does_not_break_question_management`：同时损坏
question_ids 与 bank_ids 后，编辑题目 200、删除题目 204、提交答案 400（含明确
文案）、删除题库 204。已红-绿验证：旧代码下该测试 500 失败。

## 已知限制

- 损坏快照本身不做修复或告警（无来源可还原）；该考试在读路径仍表现为空考试（#43 口径）。
