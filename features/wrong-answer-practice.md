# 错题练习

## 目标
在错题本页面增加"错题练习"功能，支持按题库筛选错题，复用现有答题流程进行针对练习。
答对后该题自动从错题本消失（基于每题最近一次作答判断）。

## 修改范围

### 后端
- `schemas.py` — 新增 `WrongAnswerStartRequest` 请求模型
- `routers/wrong_answers.py` — 重构错题查询逻辑 + 新增 `POST /api/wrong-answers/start` 端点

### 前端
- `static/js/api.js` — 新增 `startWrongAnswerExam()` 方法
- `static/js/app.js` — 错题本页面增加"错题练习"按钮 + Bootstrap Modal 选择题库弹窗
- 修复 `startExam` / `startWrongPractice` / `/exam` 路由中 `examCurrentIndex` 跨考试残留的越界 bug

### 测试
- `test_integration.py` — 新增 4 个测试用例（错题练习启动、答题流程、题库过滤、无错题场景）

## 核心实现

### 错题判定逻辑（v2）
**旧**：查所有 `AnswerRecord.is_correct == False` 记录，去重展示。
**新**：对每道题取**最近一次作答记录**，仅当最近一次答错时才算错题。用户做错题练习答对后，该题自动从错题本移除。

抽取 `_get_wrong_question_ids(user, db)` 共用函数，`GET /api/wrong-answers` 和 `POST /api/wrong-answers/start` 复用同一判定逻辑。

实现方式：
- 子查询 `MAX(answered_at) GROUP BY question_id` 获取每题最新作答时间
- 连接最近作答记录，过滤 `is_correct == False`

### API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/wrong-answers` | 列出当前错题（基于最近一次作答） |
| POST | `/api/wrong-answers/start` | 筛选错题，创建 ExamRecord，返回 exam_id |

### 前端交互
- 错题本页面 header 增加"错题练习"按钮（无错题时禁用）
- 点击弹出 Modal，列出所有题库供多选（默认全选有错题的题库）
- 确认后调用 API 创建考试，跳转到 `#/exam/{id}` 复用现有答题 UI
- 练习结束后返回错题本，答对的题已自动消失

### 数据流
1. 前端调 `POST /api/wrong-answers/start`，传 `bank_ids` 和 `timer_mode`
2. 后端通过 `_get_wrong_question_ids` 获取当前真正答错的题目 ID，按题库过滤
3. 创建 `ExamRecord`，`question_ids` 存错题 ID 列表，`mode="sequential"`，返回 `exam_id`
4. 前端跳转到 `#/exam`，复用已有答题、预览、结果流程

## Bug 修复记录

### examCurrentIndex 跨考试越界
**现象**：进入错题练习后加载题目失败，`/api/exam/{id}/current?index=4` 返回 `"索引超出范围"`。
**原因**：新考试继承了 `sessionStorage` 中上一个考试的 `examCurrentIndex`，而新考试题目数少于此 index。
**修复**：
- `startExam()` 和 `startWrongPractice()` 中增加 `sessionStorage.removeItem('examCurrentIndex'); examCurrentIndex = 0;`
- `/exam` 路由中增加边界保护：`if (examCurrentIndex >= examProgress.total_count) examCurrentIndex = 0;`

## 已知限制
- 题库过滤基于 `bank_id`，不区分错题产生的时间/考试
- 一道题答错多次只算一道错题（以用户+题目维度去重）
