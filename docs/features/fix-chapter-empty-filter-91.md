# 修复 章节筛选取消全选返回全部章节

**日期：** 2026-07-06  &emsp; **关联 Issue：** [#91](https://github.com/Liao-Ke/shuati-online/issues/91)

## 目标

考试设置和背题设置的章节筛选"取消全选"后，前端将空数组转为 `null`，后端把 `null` 当作"不过滤"，最终仍返回全部章节题目——与 UI 表达的"不选任何章节"语义相反。

## 修改范围

- `static/js/app.js`：`startReview()` 和 `startExam()` 中，当章节 checkbox 存在但未选中任何章节时阻止提交并提示
- `routers/exam.py`：`data.chapters and` → `data.chapters is not None and`，区分 `None`（不过滤）与 `[]`（空集合过滤）
- `routers/review.py`：`data.chapters:` → `data.chapters is not None:`，同上
- `test_integration.py`：新增 3 个测试验证空列表和 null 行为

## 核心实现

**防御纵深：前端拦截 + 后端区分**

- 前端：仅当存在章节 checkbox 且未选中任何章节时弹出提示并阻止提交。题库无章节时不渲染 checkbox，不受影响。
- 后端：`chapters=None`（未传）→ 不过滤（向后兼容）；`chapters=[]`（显式空列表）→ 过滤空集合，返回空结果。

## 影响范围

- `POST /api/exam/start` 和 `POST /api/review/questions` 的章节过滤分支
- 前端考试设置页和背题设置页的提交逻辑
- 不涉及数据库或其他路由

## 验证方式

1. `ruff check .` 通过
2. `pytest test_integration.py -v` 全部通过（含新增 3 项）
3. `node --check static/js/app.js` 通过

## 已知限制

- 前端拦截无法通过 TestClient 覆盖，仅以 `node --check` 语法校验作为最低验证
- 题型筛选（types）同类问题对应 Issue #77，本次不处理
