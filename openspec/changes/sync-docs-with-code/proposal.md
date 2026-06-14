## Why

`docs/` 目录中的架构文档、API 参考和 PRD 与当前代码状态存在多处不一致：`architecture.md` 仍引用已重构的 `startswith("[")` 模式、前端状态变量名已过时、`api-reference.md` 中 options/answer 序列化表述已不准确。需通读对齐，确保文档反映实际代码。

## What Changes

- `docs/architecture.md`：更新 JSON 序列化说明（引用 `utils.parse_json_field`）、更新已知限制列表、修正前端状态变量名
- `docs/api-reference.md`：审阅并修正各接口响应示例，补充 `multi_choice` 超时参数、修正 options/answer 序列化说明
- `docs/PRD.md`：审阅功能描述是否与当前实现一致
- `README.md`：审阅功能列表、API 概览、配置说明是否与实际一致

## Capabilities

### New Capabilities
- `doc-alignment`: 确保 `docs/` 下的核心文档与代码实现一致

### Modified Capabilities
- 无，纯文档修改

## Impact

- `docs/architecture.md` — 更新 JSON 序列化、前端状态、已知限制章节
- `docs/api-reference.md` — 审阅修正接口描述和示例
- `docs/PRD.md` — 按需微调
- `README.md` — 审阅功能列表、API 概览、配置说明
