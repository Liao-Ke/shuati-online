# 题目 CURD + 题库导出

**日期：** 见文件修改时间  &emsp; **关联 PRD：** [exam-platform.md](../prd/exam-platform.md)


## 目标

实现题库和题目的增删改操作，以及题库导出为 JSON 文件。解决导入后无法修改题目、无法导出数据的痛点。

## 修改范围

| 文件 | 改动 |
|------|------|
| `routers/questions.py` | **新增**，包含题目 CURD 的三个端点 |
| `routers/banks.py` | 新增题库更新和导出端点 |
| `schemas.py` | 新增 `QuestionCreate`、`QuestionUpdate`、`BankUpdate` 模型 |
| `main.py` | 注册新的 `questions` 路由 |
| `static/index.html` | 新增题目编辑、题库编辑、删除确认三个模态框 |
| `static/js/api.js` | 新增 5 个 API 调用方法 |
| `static/js/app.js` | 题库详情页集成新增/编辑/删除按钮；新增 8 个交互函数 |
| `test_integration.py` | 新增 16 个集成测试覆盖 CURD + 导出 |

## 核心实现

### 后端 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /api/question-banks/{bank_id}/questions` | 新增题目 | 含题型校验，自动计算 sort_order |
| `PUT /api/questions/{id}` | 编辑题目 | 支持切换题型时清理无关字段 |
| `DELETE /api/questions/{id}` | 删除题目 | 不影响已有 AnswerRecord/ReviewRecord |
| `PUT /api/question-banks/{id}` | 更新题库 | 修改标题和描述 |
| `GET /api/question-banks/{id}/export` | 导出题库 | 标准 JSON 格式，与导入兼容 |

### 前端交互

- 题库详情页：标题旁编辑按钮、导出按钮、新增题目按钮、每题编辑/删除按钮
- 新增/编辑题目使用统一模态框，题型切换动态渲染答案输入（单选/多选/填空/判断）
- 删除使用确认弹窗
- 题库编辑使用独立小模态框

## 影响范围

- 现有 API 和前端页面不兼容变更
- 题目编辑后已存在的答题记录不受影响（历史快照保留原有答案）

## 验证方式

```bash
rm -f exam.db && /home/Lsk/miniconda3/bin/python -m pytest test_integration.py -v
```

新增 16 项测试覆盖：
- 四种题型创建（含多空填空）
- 创建校验（选项不足、题库不存在）
- 编辑题目内容、切换题型
- 删除题目、删除不存在的题目
- 更新题库信息
- 题库导出、导出不存在的题库

## 已知限制

- 不支持跨题库移动题目
- 不支持批量删除/编辑
