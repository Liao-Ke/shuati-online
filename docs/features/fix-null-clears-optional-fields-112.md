# 修复：编辑题目/题库时显式 null 清空章节、解析、描述

**日期：** 见文件修改时间 &emsp; **关联 Issue：** [#112](https://github.com/Liao-Ke/shuati-online/issues/112)

## 目标

修复编辑题目时清空「章节」「解析」、编辑题库时清空「描述」不生效的问题：接口返回成功，但旧值仍然保留，用户无法通过界面删除这些可选字段的内容。

## 问题

1. 前端清空输入框后把空字符串转为 `null` 发送（`saveQForm` 的 `chapter = value || null`、`analysis = value || null`；`saveBankEdit` 的 `description || null`）
2. 后端 `PUT /api/questions/{id}` 用 `data.chapter if data.chapter is not None else question.chapter` 判断，`PUT /api/question-banks/{id}` 用 `if data.description is not None` 判断——`null` 被解释为「本次未修改该字段」，清空操作被静默忽略
3. 根因：schema 中这些可选字段的 `None` 同时承担「未传」和「清空」两种语义，无法区分

## 方案

用 Pydantic v2 的 `model_fields_set` 区分两种语义：字段名出现在请求体中（即使值为 `null`）才更新，未出现则保留旧值。即「显式 `null` = 清空，省略键 = 不修改」，符合 REST 部分更新惯例。

范围严格限定 issue 报告的三个可选字段：`chapter`、`analysis`（题目）、`description`（题库）。`type`/`content`/`answer`/`title` 等必填语义字段维持原有 `is not None` 行为不变——它们的 `null` 不应被解释为清空。

## 改动

| 文件 | 改动 |
|------|------|
| `routers/questions.py` | `update_question` 中 `chapter`/`analysis` 改用 `"字段名" in data.model_fields_set` 判断 |
| `routers/banks.py` | `update_bank` 中 `description` 同样改用 `model_fields_set` 判断 |
| `test_integration.py` | 新增 test_78（null 清空章节/解析并持久化）、test_79（省略键保留旧值）、test_80（题库描述省略保留 / null 清空） |

## 影响范围

- 仅 `PUT /api/questions/{id}` 与 `PUT /api/question-banks/{id}` 两个接口对三个可选字段的语义
- 前端无需改动：其现有行为（清空时发送 `null`）正是「清空」的正确表达，修复后立即生效
- 向后兼容：省略字段键的 API 调用方行为完全不变；此前显式传 `null` 的调用只有前端编辑弹窗，其期望即清空

## 验证方式

1. `ruff check .` — 0 错误
2. `pytest test_integration.py -v` — 全部通过（含新增 test_78/79/80，已做红绿检查：修复前 test_78/80 失败）
3. 新增测试覆盖：显式 null → 字段清空且持久化；省略键 → 旧值保留；题库与题目两条路径
