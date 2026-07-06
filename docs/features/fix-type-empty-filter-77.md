# 修复 题型筛选全不选返回全部题型

**日期：** 2026-07-06  &emsp; **关联 Issue：** [#77](https://github.com/Liao-Ke/shuati-online/issues/77)

## 目标

考试设置和背题设置的题型筛选"取消全选"后，前端传出空数组 `types: []`，后端用空列表的 truthiness 判断筛选条件（`if data.types:`），空列表在 Python 中为 False，被当作"没有传筛选条件"，最终返回全部题型——与 UI 表达的"全不选"语义相反。

## 修改范围

- `static/js/app.js`：`startReview()` 和 `startExam()` 中，当题型 checkbox 存在但未选中任何题型时阻止提交并提示"请至少选择一种题型"
- `routers/exam.py`：`if data.types and ...` → `if data.types is not None and ...`，区分 `None`（不过滤）与 `[]`（空集合过滤）
- `routers/review.py`：`if data.types:` → `if data.types is not None:`，同上
- `test_integration.py`：新增 `test_69b/70b/71b` 验证空列表与未传字段的不同行为

## 核心实现

**防御纵深：前端拦截 + 后端区分**（与 #91 章节筛选同类问题的修复策略一致）

- 前端：题型 checkbox 在答题/背题设置页始终存在且默认全选，未选中任何题型时弹出提示并阻止提交。
- 后端：`types=None`（未传）→ 不过滤（向后兼容）；`types=[]`（显式空列表）→ 过滤空集合，返回空结果（exam 返回 400，review 返回空数组）。

## 影响范围

- `POST /api/exam/start` 和 `POST /api/review/questions` 的题型过滤分支
- 前端考试设置页和背题设置页的提交逻辑
- 不涉及数据库或其他路由

## 验证方式

1. `ruff check .` 通过
2. `pytest test_integration.py -v` 共 100 项全部通过（含新增 3 项）
3. `node --check static/js/app.js` 通过

## 已知限制

- 前端拦截无法通过 TestClient 覆盖，仅以 `node --check` 语法校验作为最低验证
- 与 Issue #91（章节筛选）同类问题，修复策略一致但范围独立，互不阻塞