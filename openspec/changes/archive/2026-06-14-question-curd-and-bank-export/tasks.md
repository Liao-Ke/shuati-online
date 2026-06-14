## 1. 后端：题目 CURD

- [x] 1.1 创建 `routers/questions.py`，实现 `POST /api/question-banks/{bank_id}/questions` 新增题目，含题型校验（choice 至少2选项、multiple 答案不超范围等）
- [x] 1.2 实现 `PUT /api/questions/{id}` 编辑题目，支持切换题型时清理无关字段
- [x] 1.3 实现 `DELETE /api/questions/{id}` 删除题目（不影响已有 AnswerRecord / ReviewRecord）
- [x] 1.4 注册 `routers/questions.py` 到 `main.py`

## 2. 后端：题库更新与导出

- [x] 2.1 在 `routers/banks.py` 中实现 `PUT /api/question-banks/{id}` 更新题库标题和描述
- [x] 2.2 在 `routers/banks.py` 中实现 `GET /api/question-banks/{id}/export` 导出标准 JSON

## 3. 前端：API 调用层

- [x] 3.1 在 `static/js/api.js` 中添加 `createQuestion()`, `updateQuestion()`, `deleteQuestion()` 方法
- [x] 3.2 在 `api.js` 中添加 `updateBank()`, `exportBank()` 方法

## 4. 前端：题目编辑 UI

- [x] 4.1 实现新增题目按钮和模态框，根据题型动态渲染表单字段（choice/multiple 出现 options 编辑器，fill/judge 不出现）
- [x] 4.2 实现编辑题目按钮和预填表单模态框
- [x] 4.3 实现删除题目的确认弹窗
- [x] 4.4 在"题库详情"页 (#/banks/:id) 集成新增/编辑/删除按钮

## 5. 前端：题库编辑与导出

- [x] 5.1 实现题库信息编辑入口（在题库详情页或列表页可修改标题和描述）
- [x] 5.2 实现导出按钮（调用 export API 触发文件下载）

## 6. 测试

- [x] 6.1 新增集成测试覆盖：新增题目（四种题型各一条）
- [x] 6.2 新增集成测试覆盖：编辑题目（修改内容、切换题型）
- [x] 6.3 新增集成测试覆盖：删除题目
- [x] 6.4 新增集成测试覆盖：题库导出
- [x] 6.5 新增集成测试覆盖：更新题库信息
- [x] 6.6 运行 `pytest test_integration.py -v` 全部通过

## 7. 文档

- [x] 7.1 更新 README.md API 表格
- [x] 7.2 在 `features/` 中新增功能文档
