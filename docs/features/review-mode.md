# 背题模式

**日期：** 见文件修改时间  &emsp; **关联 PRD：** [exam-platform.md](../prd/exam-platform.md)


## 目标
为刷题平台增加"背题模式"——不答题、不限时，直接浏览题目与答案，逐题标记记忆状态。

## 修改范围

### 后端
- `models.py` — 新增 `ReviewRecord` 表（`user_id`, `question_id` 唯一约束，`status`: `known`/`reviewing`，计数、时间戳）
- `schemas.py` — 新增 `ReviewFilter`、`ReviewQuestionOut`、`MarkBody`、`ReviewStats`
- `routers/review.py` — 新建文件，3 个端点
- `main.py` — 注册 review router

### 前端
- `static/js/api.js` — 新增 `getReviewQuestions()`、`markReview()`、`getReviewStats()`
- `static/js/app.js` — 新增 `#/review/setup`（筛选页）和 `#/review`（一页展示页）路由
- `static/index.html` — 导航栏增加"背题"入口

### 测试
- `test_integration.py` — 增加 7 个测试用例（#15–#21），修复用户唯一性（uuid 后缀）

## 核心实现

### 数据模型
```python
ReviewRecord:
  user_id, question_id (unique together)
  status: "known" | "reviewing"
  reviewed_at, review_count
```

### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/review/questions` | 筛选 + LEFT JOIN 查询题目与 review 状态 |
| POST | `/api/review/mark` | Upsert 标记状态，返回统计 |
| GET | `/api/review/stats` | 全局统计 |

### 前端交互
- **设置页**：题库（多选）、题型（多选）、章节（精确匹配），"只看待复习"开关
- **展示页**：全部题目卡片纵排，答案直接可见，"记住了"/"待复习"按钮即时切换

## 影响范围
- 无重复依赖，无 schema 迁移（ORM 自动建表 `review_records`）
- 测试 21/21 通过

## 已知限制
- 章节筛选为精确匹配，不支持多选章节
- 前端未实现章节下拉的自动填充（需用户自行从设置页上方的章节下拉选择）
