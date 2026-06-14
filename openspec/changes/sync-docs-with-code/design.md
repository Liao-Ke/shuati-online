## Context

`docs/` 目录包含架构、API 参考、PRD 等文档，但未跟上近期的代码变更（新增加 `utils.py`、`parse_json_field` 替代 `startswith("[")` 模式、测试改 pytest 格式等）。

## Goals / Non-Goals

**Goals:**
- `architecture.md`：JSON 序列化节更新为引用 `utils.parse_json_field`；前端状态变量修正；已知限制更新
- `api-reference.md`：审阅并修正与代码不一致的响应示例和说明
- `PRD.md`：快速审阅，按需微调
- `README.md`：比对功能列表、API 概览表、配置说明与实际实现
- 不修改 `deployment.md`、`development-guide.md`、`frontend-style-guide.md`、`page-designs.md`（与代码变更无关）

**Non-Goals:**
- 不改动代码
- 不新增文档
- 不重写文档结构

## Decisions

| 决策 | 理由 |
|------|------|
| 只改 3 个核心文档 | 其余文档不涉及近期代码变更 |
| 逐文件审阅 + 针对性修正 | 避免全局重写导致引入新错误 |
| features/ 文档不动 | 每次功能实现后已更新 |

## Risks / Trade-offs

- 文档修改后可能遗漏某些不一致处 → 逐文件对照实际代码审阅
