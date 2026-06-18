# 答题导航（上一题/下一题 + 题号侧边栏）

**日期：** 见文件修改时间  &emsp; **关联 PRD：** [exam-platform.md](../prd/exam-platform.md)


## 目标
答题过程中可自由切换题目，右侧题号面板可视化显示答题进度，支持点击跳转。

## 修改范围

### 后端
- `schemas.py` — `ExamCurrent` 增加 `is_answered` / `user_answer` / `is_correct` / `correct_answer`；新增 `ExamProgress`
- `routers/exam.py` — `current` 端点支持 `?index=N` 参数；新增 `/progress` 端点

### 前端
- `static/js/api.js` — `getCurrentQuestion(examId, index)` 支持 index；新增 `getExamProgress()`
- `static/js/app.js` — 新增 `examCurrentIndex`、`loadQuestionByIndex()`、`navigateExam()`、`updateNavButtons()`、`renderQuestionGrid()`；答题页改为左右布局（左侧内容 + 右侧题号面板）
- `static/css/style.css` — 新增 `.exam-layout`、`.exam-sidebar`、`#question-grid`、`.qnum-*` 样式，自适应 5 列/10 列网格

### 测试
- `test_integration.py` — 27 项全部通过

## 核心实现

### 后端
```
GET /api/exam/{id}/current?index=N  → 第 N 题（含答案状态）
GET /api/exam/{id}/progress         → {总题数, 已答题状态列表}
```

### 前端交互
- **← 上一题 / 下一题 →** 按钮导航
- **右侧题号网格**：绿色=正确、红色=错误、灰色=未答、蓝色边框=当前题
- 点击题号跳转，答题后网格自动刷新
- 手机端自动变为 10 列横向布局

## 验证方式
```bash
python test_integration.py
# === All 27 tests passed! ===
```
