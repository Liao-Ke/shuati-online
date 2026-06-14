## Why

当前代码库存在四项可修复的技术债：`json.loads` 解析逻辑在 4 个文件中重复 9 处、`exam_result` 接口存在 N+1 查询、3 处使用 `__import__` 内联导入、`duration_seconds` 字段在单题计时模式下计算错误。这些问题不影响功能正确性，但降低可维护性，长期会拖慢开发效率。

## What Changes

1. **提取 `json.loads` 工具函数** — 新增 `utils.py`，将 `startswith("[")` 判断模式封装为 `parse_json_field()`，消除 4 个文件中的 9 处重复
2. **修复 N+1 查询** — `exam_result` 中循环 query Question 改为一次 `in_` 查询
3. **替换 `__import__` 为正规导入** — `exam.py` 和 `review.py` 中 3 处改为顶部 `import datetime`
4. **修复 `duration_seconds` 计算** — 单题计时模式下改为累加每题耗时，而非取最大值

## Capabilities

### New Capabilities
- 无新增能力，纯内部重构

### Modified Capabilities
- 无行为级变更，不需要修改 spec

## Impact

- `routers/exam.py` — 3 处修改（N+1、datetime、duration）
- `routers/review.py` — 1 处修改（datetime）
- 新增 `utils.py` — 工具函数
- `routers/wrong_answers.py` — 引用工具函数替换重复逻辑
- 测试不变，全部回归通过
