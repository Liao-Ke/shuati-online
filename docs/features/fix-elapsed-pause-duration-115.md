# 修复：整卷计时暂停时长不再计入总用时（issue #115）

## 问题

整卷计时（elapsed）模式下，前端「暂停」通过 `examElapsedOffset` + 重置 `examStartedAt` 让页面计时器跳过暂停时长；但后端 `duration_seconds` 按 `finished_at - started_at` 墙钟差值计算（提交最后一题自动结束与手动结束两条路径均如此），暂停期间全部计入。结果页/练习历史显示的用时比页面计时器多出累计暂停时长。

## 方案

前端上报计时器口径，后端采用并封顶：

- **为什么不在后端记录暂停**：需要新增 pause/resume 接口 + 表结构迁移，改动面大；暂停状态本就只存在于前端。
- **为什么要封顶**：`elapsed_seconds` 来自客户端不可信，取 `min(elapsed_seconds, 墙钟差值)` 防止伪造超长用时；负数由 schema `ge=0` 拒绝（422）。
- **兼容性**：不上报（旧客户端/其他调用方）时回退墙钟差值，行为与修复前一致。

## 修改范围

- `schemas.py`：`AnswerSubmit` 新增可选 `elapsed_seconds`（ge=0）；新增 `ExamFinish` 请求模型。
- `routers/exam.py`：新增 `_elapsed_duration()`；提交最后一题自动结束与 `finish_exam` 两条路径统一改用该函数。`finish_exam` 接受可选请求体。
- `static/js/api.js`：`submitAnswer` / `finishExam` 增加可选 `elapsedSeconds` 参数。
- `static/js/app.js`：新增 `examElapsedSeconds()`（暂停中返回偏移量；计时中返回偏移量+恢复以来秒数；非 elapsed 模式返回 null），`finishExam` 与两处 `submitAnswer` 调用点上报。

单题计时（per_question）模式不受影响：其总用时为各题 `time_spent_seconds` 之和，前端对该模式上报 null。

## 验证

- `pytest test_integration.py`：130 通过，新增 `test_115a`–`test_115e` 覆盖采用上报值、墙钟封顶、旧客户端回退、负数 422、最后一题自动结束路径。
- `node --test tests/frontend/*.test.js`：20 通过，新增 `exam_elapsed_seconds.test.js` 覆盖暂停中/计时中/时钟偏斜/未开始/非 elapsed 模式五种口径。

## 已知限制

- `elapsed_seconds` 客户端可下报（谎报比实际少），但用时仅为个人统计信息，无排名/对抗场景，墙钟封顶已足够。
- 整卷预览模式下答完最后一题后练习即自动结束，页面计时器继续走动直到用户点击「结束」，结果页用时以答完最后一题时刻为准（修复前已如此）。
