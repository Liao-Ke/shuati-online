# 修复选择题和多选题允许空白选项（#49）

**日期：** 2026-07-06  &emsp; **关联 Issue：** [#49](https://github.com/Liao-Ke/shuati-online/issues/49)

## 目标

`validate_bank_import` 和 `_validate_question` 原本只校验 choice/multiple 的选项数量，没有校验每个选项文本是否非空。直接调用 API 时可以持久化 `""` 或 `"   "` 这类空白选项，前端会渲染出不可见选项。本次在后端写入边界拒绝空白选项。

## 修改范围

- `routers/banks.py`：题库导入校验中，choice/multiple 题拒绝空白选项
- `routers/questions.py`：题目新增/编辑校验中，choice/multiple 题拒绝空白选项
- `test_integration.py`：新增空白选项回归测试，覆盖导入、批量导入、新增和编辑入口

## 核心实现

对 choice/multiple 的 `options` 做空白字符串检查：

```python
if options and any(not o.strip() for o in options):
    errors.append("...选项不能包含空白字符串")
```

校验发生在答案范围校验之前，避免空白选项被当成有效选项标签参与后续判断。

## 影响范围

- 仅影响 choice/multiple 题的写入边界
- 合法非空选项行为不变
- 前端表单本来会过滤空白行，本次补齐后端信任边界校验

## 验证方式

1. `ruff check routers/banks.py routers/questions.py test_integration.py`
2. `py_compile routers/banks.py routers/questions.py test_integration.py`
3. GitHub CI：lint、test、docker-build、CodeQL、Analyze 全部通过后合并

## 已知限制

- 不迁移历史数据库中已经存在的空白选项；本修复只阻止新写入和编辑保存。
