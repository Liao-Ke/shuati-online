## ADDED Requirements

### Requirement: 项目文档与代码实现保持一致

所有项目文档（PRD、API 参考、架构文档）应准确反映当前版本的代码实现。

#### Scenario: PRD 约束不再包含已实现功能的限制
- **WHEN** 读者查阅 PRD 约束与边界
- **THEN** "不可修改题目"和"无数据导出"已移除或标记为已支持

#### Scenario: PRD 未来方向中已实现项已标注
- **WHEN** 读者查阅 PRD 未来方向
- **THEN** "题目编辑"和"批量导出"已标记为已实现或移除

#### Scenario: API 参考包含所有新端点
- **WHEN** 读者查阅 API 参考
- **THEN** 包含题目 CURD (POST/PUT/DELETE)、题库更新 (PUT)、题库导出 (GET) 的完整文档

#### Scenario: 架构文档已知限制已更新
- **WHEN** 读者查阅架构文档已知限制
- **THEN** 已移除或更新关于题目不可编辑和数据不可导出的条目
