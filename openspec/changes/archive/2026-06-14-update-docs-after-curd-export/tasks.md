## 1. 更新 PRD.md

- [x] 1.1 将"约束与边界"中"不可修改题目"更新为"题目支持新增/编辑/删除"
- [x] 1.2 将"无数据导出"更新为"题库支持 JSON 导出"
- [x] 1.3 在"未来方向"中将"题目编辑"和"批量导出"标记为已实现或移除

## 2. 更新 api-reference.md

- [x] 2.1 新增 `PUT /api/question-banks/:id` 更新题库信息
- [x] 2.2 新增 `GET /api/question-banks/:id/export` 导出题库
- [x] 2.3 新增 `POST /api/question-banks/:bank_id/questions` 新增题目
- [x] 2.4 新增 `PUT /api/questions/:id` 编辑题目
- [x] 2.5 新增 `DELETE /api/questions/:id` 删除题目

## 3. 更新 README.md

- [x] 3.1 在"功能"章节新增"题目编辑"（新增/编辑/删除单题）
- [x] 3.2 在"功能"章节新增"题库导出"和"题库编辑"

## 4. 更新 architecture.md

- [x] 4.1 更新已知限制，移除/更新题目不可编辑和数据不可导出条目
- [x] 4.2 更新路由表，添加题目 CURD 模块信息
