# 修复未作答考试结果页占位符问题（#50）

**日期：** 见文件修改时间  &emsp; **关联 Issue：** #50

## 目标

用户开始考试后不作答任何题目直接结束，后端已把全部未作答题计入 `wrong_count` 并返回真实统计（`total_count` / `correct_count` / `wrong_count` / `accuracy`），但前端结果页和历史详情页用 `result.answers.length > 0` 决定是否显示汇总，导致 `0 道已答但考试已完成` 的场景显示 `—分`、`—正确`、`—错误`，与后端真实结果不一致。本次让汇总直接使用后端值，`answers.length` 仅用于判断明细列表空状态。

## 修改范围

- `static/js/app.js`
  - `/result/:id` 路由（结果页）
  - `/history/:id` 路由（历史详情页）

## 核心实现

1. 结果页：`acc` / `cc` / `wc` 不再以 `hasAnswers` 三元判断，直接取 `result.accuracy` / `result.correct_count` / `result.wrong_count`；"查看详情"按钮始终显示（历史详情页汇总已修正，0 答案也能看到真实统计）。
2. 历史详情页：`acc` / `cc` 直接取后端值；汇总行 `${cc}/${result.total_count}` 不再用 `hasAnswers` 兜底。
3. 两处明细列表空状态判断由 `!hasAnswers` 改为 `!result.answers.length`，语义不变——仅控制明细区显示"还没有作答记录"，不再隐藏汇总。

## 影响范围

- 仅前端两个路由的汇总展示逻辑
- 后端接口、API 层、其他路由均不改动
- `exam_result` / `history_detail` 对非 completed 考试返回 409，对 completed 考试始终返回真实统计，前端可直接信任

## 验证方式

1. `node --check static/js/app.js` 语法通过
2. `pytest test_integration.py` 72 项集成测试全部通过（无后端改动，仅回归确认）
3. node 模拟 0 答案已完成考试：`acc=0 cc=0 wc=2`，明细空状态触发；正常考试回归：`acc=50 cc=1 wc=1`

## 已知限制

- 明细列表为空时仍展示"还没有作答记录"空状态，与汇总共存，符合 issue #50 期望（汇总不隐藏、明细可空）。
