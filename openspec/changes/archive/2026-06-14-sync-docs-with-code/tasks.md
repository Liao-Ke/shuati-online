## 1. 更新架构文档

- [x] 1.1 `docs/architecture.md`：JSON 序列化节引用 `utils.parse_json_field`
- [x] 1.2 `docs/architecture.md`：前端状态变量名修正（`api.token`、`state.user`）
- [x] 1.3 `docs/architecture.md`：已知限制列表移除已修复的 `startswith("[")` 条目

## 2. 更新 API 参考

- [x] 2.1 `docs/api-reference.md`：审阅各端点，修正与代码不符的示例
- [x] 2.2 `docs/api-reference.md`：补充多选题超时参数 `multi_choice_timeout` 说明

## 3. 更新 README

- [x] 3.1 `README.md`：比对功能列表与当前实现，修正过时条目
- [x] 3.2 `README.md`：审阅 API 概览表，确认路径和说明准确
- [x] 3.3 `README.md`：确认配置环境变量及默认值与代码一致

## 4. 审阅 PRD

- [x] 4.1 `docs/PRD.md`：逐一比对用户故事与当前功能，修正过时描述

## 5. 验证

- [x] 5.1 运行集成测试，确认文档修改不破坏代码
