## Context

目前题库只能通过 JSON 文件批量导入，不支持单题增删改；题库信息（标题、描述）导入后不可修改；题库数据无法导出，用户无法备份或迁移数据。这些限制构成日常使用中的主要痛点。

## Goals / Non-Goals

**Goals:**
- 支持在题库内增、删、改单道题目（四种题型）
- 支持修改题库标题和描述
- 支持将题库导出为 JSON 文件（与导入格式兼容）
- 前端提供对应的操作入口和弹窗

**Non-Goals:**
- 不做批量删除/编辑题目（后续需要可加）
- 不做导出格式选择（仅 JSON）
- 不做跨题库移动题目

## Decisions

### 1. 新增 `routers/questions.py` 路由模块

**决策**：题目 CRUD 不塞进已有的 `routers/banks.py`，单独成一个路由文件。

**理由**：bank 路由目前做导入/列表/详情/删除，职责已经较杂；题目 CURD 是新增的独立能力域，拆分后每个文件职责清晰，也符合现有架构模式。

### 2. 题库元信息更新复用 `routers/banks.py`

**决策**：在 `banks.py` 中新增 `PUT /api/question-banks/{id}`。

**理由**：只改 bank 的两个字段（title, description），没有跨模块逻辑，加到已有的 bank 路由自然合理。

### 3. 题库导出复用 banks.py

**决策**：在 `banks.py` 中新增 `GET /api/question-banks/{id}/export`。

**理由**：导出本质是 bank 详情的扩展（序列化为 JSON），与导入对称。

### 4. 前端用模态框实现编辑

**决策**：题目编辑/新增使用 Bootstrap 模态框，不另开页面。

**理由**：项目当前所有交互都在同一页面内完成，模态框模式一致；编辑内容不复杂，不需要独立页面。

### 5. 数据模型不改

**决策**：`Question` 和 `QuestionBank` 现有字段已满足 CURD 需求，无需新增字段或改表结构。

### API 设计

```
# 题目 CURD（新文件 routers/questions.py）
POST   /api/question-banks/{bank_id}/questions    # 新增题目
PUT    /api/questions/{id}                        # 编辑题目
DELETE /api/questions/{id}                        # 删除题目

# 题库更新（已有 routers/banks.py）
PUT    /api/question-banks/{id}                   # 更新题库信息

# 题库导出（已有 routers/banks.py）
GET    /api/question-banks/{id}/export            # 导出为 JSON
```

请求/响应格式与现有导入格式兼容。

## Risks / Trade-offs

- **删除题目后关联数据**：已存在的 AnswerRecord 和 ReviewRecord 仍引用该 question_id，删除题目会导致这些记录指向不存在的题目。→ 删除时保留 question_id 的外键引用（不设 ON DELETE CASCADE），历史记录可正常展示但显示"题目已删除"
- **前端编辑弹窗复杂度**：四种题型的编辑表单差异大（选择题需 options，填空题无 options，多选题多选答案）。→ 根据 `type` 动态渲染表单字段
