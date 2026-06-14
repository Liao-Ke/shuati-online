## 1. 新增工具函数

- [x] 1.1 创建 `utils.py`，实现 `parse_json_field(val)` 函数，统一处理 JSON 字面量反序列化

## 2. 替换重复逻辑

- [x] 2.1 在 `routers/exam.py` 中所有 9 处 `json.loads` + `startswith("[")` 替换为 `parse_json_field()`
- [x] 2.2 在 `routers/wrong_answers.py` 中 2 处替换为 `parse_json_field()`

## 3. 修复 N+1 查询

- [x] 3.1 `exam_result` 中循环 `db.query(Question)` 改为 `in_` 一次性查询

## 4. 修复内联导入

- [x] 4.1 `routers/exam.py` 中 2 处 `__import__("datetime")` 替换为顶部 `import datetime`
- [x] 4.2 `routers/review.py` 中 1 处 `__import__("datetime")` 替换为顶部 `import datetime`

## 5. 修复 duration_seconds 计算

- [x] 5.1 `routers/exam.py` 提交答案时 `max(...)` 改为累加 `exam.duration_seconds += record.time_spent_seconds`

## 6. 验证

- [x] 6.1 运行 `pytest test_integration.py -v`，确认全部通过
