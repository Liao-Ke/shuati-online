## Purpose

支持将题库导出为标准 JSON 文件，以及与导入格式一致的兼容性；支持修改题库基本信息（标题、描述）。

## ADDED Requirements

### Requirement: 用户可导出题库为 JSON 文件

用户在题库列表页或详情页点击"导出"按钮，系统生成与导入格式兼容的 JSON 文件并下载。

#### Scenario: 导出成功
- **WHEN** 用户在题库详情页点击"导出"
- **THEN** 系统返回题库的完整 JSON 表示，包含 title、description 和所有 questions（含 answer 和 analysis），浏览器下载该文件

#### Scenario: 导出格式与导入格式兼容
- **WHEN** 用户导出一个题库
- **THEN** 导出的 JSON 文件可以直接通过"导入题库"功能重新导入到系统

#### Scenario: 空题库导出
- **WHEN** 用户导出一个没有任何题目的空题库
- **THEN** 系统返回包含 title 和 description 的 JSON，questions 数组为空

#### Scenario: 导出不存在的题库
- **WHEN** 用户导出不存在的 bank_id
- **THEN** 系统返回 404

### Requirement: 用户可更新题库基本信息

用户在题库列表页或详情页可修改题库的标题和描述。

#### Scenario: 更新题库标题
- **WHEN** 用户将题库标题从"数据结构"改为"数据结构与算法"
- **THEN** 系统更新题库标题，题库列表和详情中显示新标题

#### Scenario: 更新题库描述
- **WHEN** 用户修改题库的描述文本
- **THEN** 系统更新描述字段

#### Scenario: 只更新标题不更新描述
- **WHEN** 用户只提供了新的 title 未提供 description
- **THEN** 系统仅更新 title，description 保持原值不变
