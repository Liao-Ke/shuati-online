# 后端技术债清理

**日期：** 见文件修改时间  &emsp; **关联 PRD：** 无（基础设施/工具链）


## 目标

消除代码库中四项可维护性问题：`json.loads` 重复逻辑、N+1 查询、`__import__` 内联导入、`duration_seconds` 计算错误。

## 修改范围

| 文件 | 改动 |
|------|------|
| `utils.py` | 新增，提供 `parse_json_field()` 统一 JSON 字段反序列化 |
| `routers/exam.py` | 替换 9 处 `json.loads` → `parse_json_field`；修复 N+1；替换 `__import__`；修复 `duration_seconds` 累加 |
| `routers/wrong_answers.py` | 替换 3 处 `json.loads` → `parse_json_field` |
| `routers/review.py` | 替换 `__import__("datetime")` → `import datetime` |

## 核心实现

- `parse_json_field(val)` 封装了 `startswith("[")` + `json.loads` + try/except 逻辑，消除 4 个文件中的模式重复
- N+1 修复：`exam_result` 中收集所有 `question_id`，一次 `in_` 查询后构建字典
- `duration_seconds` 从 `max()` 改为累加，语义上正确记录总用时

## 影响范围

- 所有 API 响应格式不变，纯内部重构
- `duration_seconds` 值在已有历史记录中会变（之前为单题最大耗时，之后为累计总用时）

## 验证方式

运行 `test_integration.py`，28 项测试全部通过。
