# 修复示例题库选项字母前缀，确立"options 存纯文本，前端渲染字母"契约

**日期：** 2026-07-03  &emsp; **关联 Issue：** [#51](https://github.com/Liao-Ke/shuati-online/issues/51)

## 目标

移除所有示例数据和文档中 choice/multiple 题选项的 `A.`、`B.` 等字母前缀，确立"数据库存纯文本选项，前端渲染时自动加字母编号"的数据契约，消除 `A. A.` 重复标签问题。

## 问题描述

用户在手动录入题目时，options 字段同时包含字母前缀和选项文本（如 `["A. 选项一", "B. 选项二"]`），前端渲染时又自动追加 `A.`、`B.` 等字母编号，导致选项显示为 `A. A. 选项一`、`B. B. 选项二` 等重复标签。

## 修改方案

核心原则：**数据库/JSON 中只存纯选项文本，前端渲染 choice/multiple 题时按索引自动生成 `A.`、`B.` 等字母编号**。

### 改动表

| 文件 | 改动 |
|------|------|
| `static/js/app.js:1897-1901` | `downloadSample()` 示例数据的 choice/multiple 选项移除字母前缀 |
| `static/js/app.js:2128` | 录题表单提交逻辑：对用户输入的选项做 `replace(/^[A-Z]\.\s*/, '')` 去前缀兜底 |
| `static/index.html:77-78` | 录题表单 label 和 placeholder 改为无前缀提示 |
| `README.md` | 示例 JSON 中 choice/multiple 选项移除字母前缀 |
| `docs/api/endpoints.md` | 接口文档中 12 处 choice/multiple 选项示例移除字母前缀 |
| `docs/arch/system.md` | 系统架构文档中 options 列示例更新 |
| `docs/db/schema.md` | 数据库设计文档中 options 列示例更新 |
| `docs/designs/development-guide.md` | 开发指南中代码示例更新 |
| `docs/designs/page-designs.md` | 页面设计文档中示例更新 |
| `docs/prd/exam-platform.md` | PRD 中数据契约表更新 |
| `test_integration.py` | 11 处测试 fixture options 移除字母前缀 |
| `test_integration.py` | 新增 `test_02b_import_bank_options_no_prefix` 回归测试 |

### 核心数据契约变更

```
旧：options: ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"]
新：options: ["选项一", "选项二", "选项三", "选项四"]

answer 字段不变（仍为 A/B/C/D 字母索引）
```

## 影响范围

- 已有数据库中带前缀的 options 不会自动迁移（属旧数据，用户需重新导入或手动编辑）
- 前端渲染逻辑不变，仍按索引自动加字母编号
- 后端路由和判题逻辑不受影响（answer 字段未变）

## 验证方式

1. `node --check static/js/app.js` 通过
2. `ruff check .` 通过
3. `pytest test_integration.py -v` 全部通过，含新增回归测试
4. 新测试 `test_02b_import_bank_options_no_prefix` 验证导入后 options 项均不匹配 `/^[A-Z]\./`

## 已知限制

- 不处理存量旧数据中的带前缀 options，仅对新导入/录入的数据生效
