# 修复结果页提前清空考试恢复状态

**日期：** 2026-07-07  &emsp; **关联 Issue：** #86

## 目标
未完成考试误进入结果页时，前端不应在确认结果可加载前清空 `activeExamId` 等恢复状态，否则用户无法回到当前考试继续作答。

## 修改范围
- `static/js/app.js`
  - 将结果页的考试恢复状态清理移动到 `api.getExamResult(id)` 成功返回之后。
  - 当结果接口返回 409 时，保留 sessionStorage 中的考试状态，并显示「考试尚未完成」与「继续作答」入口。
  - 成功加载结果后清理 `activeExamId`、`examCurrentIndex`、`examMode`、`examTimerMode`、`examStartedAt`、`examTimeouts`。
- `static/js/api.js`
  - `api.request()` 抛错时保留 HTTP `status`，同时继续保持 401 登录态失效处理。
- `tests/frontend/`
  - 覆盖 API 错误状态码传播。
  - 覆盖未完成结果页保留恢复状态、已完成结果页成功后清理恢复状态。

## 验收点
- 未完成考试访问 `#/result/:id` 收到 409 后，可点击「继续作答」回到 `#/exam`。
- 409 分支不清理恢复状态。
- 已完成考试结果页行为保持不变，并在结果成功加载后清理恢复状态。

## 验证
- `node --check static/js/app.js`
- `node --check static/js/api.js`
- `node --test tests/frontend/*.test.js`
- `/home/Lsk/miniconda3/bin/python -m ruff check .`
