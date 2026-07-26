# 恢复未完成考试（issue #44）

## 背景

后端一直保留 `ExamRecord.status = "in_progress"`，但前端恢复只依赖 `sessionStorage`（同标签页会话）。浏览器会话丢失后，进行中的考试变成"孤儿"：数据还在，UI 没有任何找回入口。

## 修改范围

### 后端

- `schemas.py`：新增 `UnfinishedExam` 摘要模型。
- `routers/exam.py`：新增 `GET /api/exam/unfinished`，返回当前用户全部进行中考试（exam_id、题库标题、模式、计时方式、已答/总题数、开始时间），按开始时间倒序。题库标题查询带 `user_id` 归属过滤：`exam.bank_ids` 历史上可能含未经归属校验的 id（issue #125）或已被他人复用的 id（issue #123 威胁模型），不过滤会泄露他人题库标题（审查中补充，含跨用户测试）。

「放弃」不引入新状态/新接口，复用 `POST /api/exam/:id/finish`（未答题计为错误），与已有"提前结束"语义一致。

### 前端

- `static/js/api.js`：`getUnfinishedExams()`。
- `static/js/app.js`：
  - `renderUnfinishedExams()`：「继续未完成考试」卡片，dashboard 与答题设置页共用，含"继续答题/放弃"按钮。
  - `resumeUnfinishedExam()`：恢复入口。同会话同考试直接回 `/exam`（sessionStorage 进度仍有效）；跨会话则以后端数据重建会话状态。
  - `abandonUnfinishedExam()`：确认后调 `finishExam` 结清并刷新页面。
  - `checkUnfinishedConflict()` + `abandonExamsQuietly()`：`startExam` 与 `startWrongPractice` 开始前查询未完成考试，存在时明确提示「放弃并新开 / 取消」；确认后**先创建新考试、成功后再结清旧考试**——开考被服务端拒绝（筛选组合无题、网络错误）时旧考试不受影响。
  - `/exam` 路由：sessionStorage 无 `examCurrentIndex` 时（跨会话恢复），根据 progress 定位到第一道未答题。
  - `parseUtcDate()`：后端 naive UTC 时间串统一补 `Z` 再解析，同步修正了「最近练习」「练习历史」两处沿用已久的本地时区误读，保证同一考试在恢复卡片与历史列表中显示一致。

### 放弃时的用时口径（整卷计时）

放弃路径显式传 `elapsed_seconds`：本会话活跃考试用前端计时器口径（`examElapsedSeconds()`，不含暂停时长）；跨会话遗留考试真实用时不可知，传 `0`。二者都避免后端回退为 `finished_at - started_at` 的墙钟差把离开数天全部计入用时，与 issue #115 确立的口径一致。

## 验证方式

- 后端：`test_integration.py` 新增 3 个用例（401 未认证、生命周期 空→开考→作答计数→放弃后消失且 `elapsed_seconds=0` 不回退墙钟、多场倒序 + 用户隔离），全部通过。
- 前端：`tests/frontend/resume_unfinished.test.js` 新增 3 个用例（首个未答题定位、已存索引优先、新考试从 0 开始），全部通过。
- 提交前经多智能体对抗性审查，修复了审查确认的 5 类问题（放弃用时墙钟回退、先弃后建的数据丢失窗口、setup 页同会话快速路径失效、时区显示不一致、批量放弃后 sessionStorage 悬挂）。

## 已知限制

- 单题计时的自定义倒计时秒数（choice/multi/fill timeout）后端未持久化，跨会话恢复后退回默认 30/45/60 秒。如需精确恢复，需在 `ExamRecord` 上存储超时配置。
- 整卷计时跨会话恢复后，计时从恢复时刻重新累计（不把离开时长计入用时），与暂停口径一致（issue #115）；最终成绩用时仍由后端以墙钟差值封顶（防伪造）。
- `GET /api/exam/unfinished` 对每场考试单独查询已答数与题库标题（N+1）。未完成考试通常个位数，量级可忽略；若未来允许大量并存，应改为按 exam_id/bank_id 聚合的批量查询。
