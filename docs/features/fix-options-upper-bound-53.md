# 修复选择题和多选题选项数量无上限导致前端 undefined 标签（#53）

**日期：** 2026-07-06  &emsp; **关联 Issue：** [#53](https://github.com/Liao-Ke/shuati-online/issues/53)

## 目标

前端使用固定标签 `ABCDEFGH`（8 个）渲染 choice/multiple 选项，后端原本只校验选项数量下限（>= 2），没有上限。当选项超过 8 个时，第 9 个及以后在前端显示为 `undefined.` 标签。本次采用方案 A：在后端写入边界拒绝超过 8 个选项的 choice/multiple 题，返回 400，不改动前端渲染逻辑。

## 修改范围

- `routers/banks.py`：`validate_bank_import` 中 choice/multiple 题新增 `len(options) > 8` 上限校验
- `routers/questions.py`：`_validate_question` 中 choice/multiple 题新增 `len(options) > 8` 上限校验
- `test_integration.py`：新增回归测试，覆盖 import、import-multiple、create、update 四条入口的 9 选项拒绝与 8 选项通过边界

## 核心实现

对 choice/multiple 的 `options` 做上限检查，紧贴现有 `len < 2` 下限检查之后：

```python
if options and len(options) > 8:
    errors.append("...选项不能超过 8 个（A-H）")
```

非法数据在 API 边界返回 400，与 #45、#49 的校验模式保持一致。

## 影响范围

- 仅影响 choice/multiple 题的写入边界
- 8 个及以下选项的合法用例行为完全不变
- 不改动前端渲染、不扩展标签体系、不动数据库 schema、不动其他题型

## 验证方式

1. `ruff check routers/banks.py routers/questions.py test_integration.py`
2. `pytest test_integration.py -v`
3. 手工复现：导入 9 选项题库应返回 400，导入 8 选项题库应返回 201

## 已知限制

- 不迁移历史数据库中已存在的超过 8 个选项的题目；本修复只阻止新写入和编辑保存。
- 若未来需要支持 8 个以上选项，需同步调整前端标签生成逻辑并移除本上限校验。
