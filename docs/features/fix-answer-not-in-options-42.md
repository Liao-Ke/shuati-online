# 修复导入或编辑选择题时不校验答案是否属于现有选项

**日期：** 2026-07-04  &emsp; **关联 Issue：** [#42](https://github.com/Liao-Ke/shuati-online/issues/42)

## 目标

`validate_bank_import`（`routers/banks.py`）和 `_validate_question`（`routers/questions.py`）只校验"有选项""答案非空"，未校验选择题/多选题答案是否落在现有选项标签范围内，导致"只有 A、B 两个选项但答案写成 C"的必错题被持久化。

## 修改范围

- `routers/banks.py` `validate_bank_import`：choice 与 multiple 分支各新增答案范围校验
- `routers/questions.py` `_validate_question`：同上
- `test_integration.py`：新增 7 个回归测试覆盖导入/批量导入/新建/编辑四条路径
- `docs/features/fix-answer-not-in-options-42.md`：本功能文档

## 核心实现

选项标签按位置映射为字母 `A`、`B`、`C`...（`chr(65 + i)`），与 `submit_answer` 的运行时校验（issue #55）保持一致。

校验规则：
- **choice**：答案（字符串）必须属于现有选项标签集合
- **multiple**：答案（列表）的每个元素必须属于现有选项标签集合，且不允许重复

校验仅在答案基本格式通过后触发（`elif q.options:`），选项缺失时跳过范围检查（选项错误已由前序校验报告），不产生重复报错。

覆盖四个写入入口：`POST /api/question-banks/import`、`POST /api/question-banks/import-multiple`、`POST /api/question-banks/{bank_id}/questions`、`PUT /api/questions/{question_id}`，非法数据返回 400。

## 影响范围

- 仅 choice / multiple 题型的写入边界
- 合法答案（标签在选项范围内）行为完全不变，向后兼容
- 不涉及数据库、其他路由或前端

## 验证方式

1. `ruff check .` 通过
2. `pytest test_integration.py` 79 项全部通过（含新增 7 项）
3. 红绿验证：临时还原修复后 7 个新测试全部失败，应用修复后全部通过

## 已知限制

- 无
