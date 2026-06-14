# 答题导航（上一题/下一题）

## 目标
答题过程中可以自由切换上一题/下一题，已答题目可回看答案。

## 修改范围

### 后端
- `schemas.py` — `ExamCurrent` 增加 `is_answered`、`user_answer`、`is_correct`、`correct_answer` 字段
- `routers/exam.py` — `GET /exam/{id}/current` 接受可选 `index` 参数，按索引返回题目（已答题含答案信息）

### 前端
- `static/js/api.js` — `getCurrentQuestion(examId, index)` 支持传 index
- `static/js/app.js` — 新增 `examCurrentIndex`、`loadQuestionByIndex()`、`navigateExam()`、`updateNavButtons()`；答题头部新增 ← 上一题 / 下一题 → 按钮和进度 `3 / 20`

### 其他
- `database.py` — `DATABASE_URL` 环境变量支持
- `requirements.txt` — 新增 `bcrypt==4.1.3`（修复 passlib 兼容性）、`greenlet==3.5.1`
- `Dockerfile`、`docker-compose.yml`、`.dockerignore` — Docker 构建部署支持

### 测试
- `test_integration.py` — 增加导航测试 3 条（按索引获取、已答/未答状态、越界），27 项全部通过

## 核心实现

```
GET /api/exam/{exam_id}/current?index=N
  → 返回第 N 题（0-based）
  → is_answered=true 时附带 user_answer / is_correct / correct_answer
```

- 未答题：显示题目+选项+计时器
- 已答题：显示反馈视图（正确/错误+用户答案+正确答案）
- 导航按钮在边界自动禁用（第一题/最后一题）

## 验证方式

```bash
python test_integration.py
# === All 27 tests passed! ===

# 容器内验证
docker build -t shuati:latest .
docker run -d -p 8000:8000 shuati:latest
```
