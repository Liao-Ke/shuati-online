## Why

当前题库和题目只支持 JSON 批量导入，导入后无法修改。用户发现答案错误、标题写错或需要补充题目时，只能删除题库重新导入。缺少单个题目增删改和题库导出能力，导致数据维护成本高。

## What Changes

- **题目 CURD**：在题库内增、删、改单道题目，支持前端编辑弹窗
- **题库信息更新**：修改题库标题和描述
- **题库导出**：将题库导出为 JSON 文件（与导入格式兼容，支持下载）
- **（无 BREAKING 变更）**

## Capabilities

### New Capabilities
- `question-curd`: 题库内的单题增加、编辑、删除操作，支持 choice/fill/judge/multiple 四种题型
- `bank-export`: 将题库导出为标准 JSON 文件下载，格式与导入兼容

### Modified Capabilities
- （无现有 spec 被修改）

## Impact

- **后端**：新增 `routers/questions.py` 路由模块（或扩展 `routers/banks.py`），包含题目 CRUD 和导出的 API 端点
- **前端**：题库详情页增加"编辑"按钮、题目编辑弹窗、导出按钮；新增单题添加入口
- **数据模型**：`Question` 和 `QuestionBank` 表结构不变，复用现有字段
- **测试**：补充新的集成测试覆盖题目 CRUD 和导出流程
