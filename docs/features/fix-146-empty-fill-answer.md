# 修复：填空题答案拒绝空数组（issue #146）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #146

## 问题

填空题校验只拦「数组里含空值」，不拦「数组本身为空」——`any()` 对空数组恒为 False 直接放行。
`answer: []` 入库后生成畸形题：

- `blank_count = len([]) = 0`，前端按空位数渲染 0 个输入框（#82 起），题目无法作答；
- 判分时 `correct_answer = []`，空提交 `[]` 逐位比对全部通过直接判对，任何非空提交判错。

导入（`routers/banks.py`）、新建/编辑（`routers/questions.py`）三条路径均放行。

## 修改范围

- `routers/questions.py` `_validate_question`：fill 分支先判空数组，报「填空题答案数组不能为空」。
- `routers/banks.py` 导入校验：同口径修复（两处校验重复合并属 issue #139 范围，本次不动）。
- `test_integration.py`：新增 `test_146_fill_answer_rejects_empty_array`，覆盖导入/新建/编辑
  三条路径均 400，且编辑被拒后原答案未被破坏。

## 验证方式

```bash
/home/Lsk/miniconda3/bin/python -m pytest -q   # 162 passed
ruff check .                                    # All checks passed
```

已做红-绿验证：还原旧校验后新测试失败（导入返回 201），修复后通过。

## 已知限制

- 与 #49/#42 同口径的边界校验，不处理数组元素为非字符串类型的情况（`a.strip()` 对
  int 元素会 500）——该输入形态需先经 Pydantic schema 放行才可达，如需收紧属独立问题。
- 已入库的存量空数组题不做数据清洗，仅堵新增入口。

## 过程中发现的独立 bug（另行建 Issue）

编写编辑路径测试时暴露：`update_question`/`delete_question`/`delete_bank` 的进行中考试
检查对 `parse_json_field` 的返回值未做 isinstance(list) 防护——快照损坏（返回原始字符串）时
`int in str` 抛 TypeError → 500，用户带着一条损坏快照的进行中考试将无法编辑/删除任何题目。
共 4 处同类（banks.py:203、questions.py:130/182、exam.py:275）。本测试改用隔离用户绕开。
