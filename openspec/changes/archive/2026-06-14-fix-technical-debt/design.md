## Context

后端 4 个文件中存在可修复的技术债，均为独立、低风险的内部重构，不涉及 API 行为变更或数据模型改动。

## Goals / Non-Goals

**Goals:**
- 消除 `json.loads` 条件判断在 4 个文件中的 9 处重复
- 修复 `exam_result` 中每次 query 一条 Question 记录的 N+1 查询
- 将 3 处 `__import__("datetime")` 替换为顶部 `import datetime`
- 修复 `duration_seconds` 在单题计时模式下只记录单题最大耗时而非累计总用时的 bug

**Non-Goals:**
- 不改动 API 请求/响应格式
- 不改动数据模型
- 不改动前端代码
- 不改动测试（已有集成测试应全部通过）

## Decisions

| 决策 | 方案 | 理由 |
|------|------|------|
| 工具函数文件 | 新增 `utils.py` | 逻辑简单，不需要独立包；与现有代码风格一致 |
| N+1 修复 | 用 `questions = {q.id: q for q in db.query(Question).filter(...).all()}` 构建字典 | SQLite 不支持 `joinedload` 的复杂场景，字典方案最直接 |
| `duration_seconds` | 提交答案时累加 `exam.duration_seconds += record.time_spent_seconds` | 与前端"整卷计时"行为一致，语义正确 |

## Risks / Trade-offs

- 修改涉及 4 个后端文件，但每个改动点独立且被集成测试覆盖
- `duration_seconds` 改动会改变现有历史记录的值（之前为 max，之后为 sum），对已有记录需要确认影响——当前只读取不依赖具体值，兼容
