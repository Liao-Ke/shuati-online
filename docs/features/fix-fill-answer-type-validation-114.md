# 修复：单空填空题提交数组答案返回 400 而非 500

**日期：** 见文件修改时间 &emsp; **关联 Issue：** [#114](https://github.com/Liao-Ke/shuati-online/issues/114)

## 目标

修复 `POST /api/exam/{exam_id}/answer` 对填空题缺少答案类型校验的问题。单空填空题（正确答案为字符串）收到数组 `user_answer` 时，判分逻辑对数组调用 `.strip()`，抛出 `AttributeError` 并返回 500。

## 问题

1. `AnswerSubmit.user_answer` 类型为 `str | list[str] | None`，数组可通过 Pydantic 校验进入判分逻辑
2. `routers/exam.py` 中 choice/judge/multiple 均有显式答案类型校验（类型不符返回 400），唯独 fill 没有校验分支
3. 单空题判分执行 `(data.user_answer or "").strip()`，`user_answer` 为非空数组时 `or` 短路返回数组，`.strip()` 崩溃产生未处理异常

## 方案

在现有校验链中补充 fill 分支：正确答案为字符串（单空题）且 `user_answer` 非 None 时，要求其必须为字符串，否则返回 400「单空填空题答案必须为字符串」，与 choice 提交数组返回 400 的行为对齐。

**刻意不校验多空题（正确答案为列表）**：多空题判分兼容字符串提交（包装为单元素列表），且现有前端对多空题只渲染单输入框、提交的就是字符串（见 issue #82），在此拦截会破坏现网答题流程。

## 改动

| 文件 | 改动 |
|------|------|
| `routers/exam.py` | `submit_answer` 校验链新增 `elif question.type == "fill"` 分支：单空题的非字符串答案返回 400 |
| `test_integration.py` | 新增 `test_77_submit_answer_rejects_list_for_single_blank_fill`：数组答案 → 400 且不写入答题记录，随后合法字符串答案 → 200 正常判分 |

## 影响范围

- 仅 `POST /api/exam/{exam_id}/answer` 的 fill 题型请求边界
- 正常前端流程不受影响（单空题前端只提交字符串）；多空题行为完全不变
- 附带行为收敛：单空题提交空数组 `[]` 由原先「静默判错」变为 400，与类型校验语义一致

## 验证方式

1. `ruff check .` — 0 错误
2. `pytest test_integration.py -v` — 全部通过（含新增 test_77）
3. 新增测试覆盖：单空题数组答案 → 400 + 无答题记录，字符串答案 → 200 + 正确判分
