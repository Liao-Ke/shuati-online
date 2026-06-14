## Purpose

确保项目文档与代码实现保持一致，降低维护者对过时文档的困惑。

## Requirements

### Requirement: Architecture document reflects current code
`docs/architecture.md` SHALL accurately describe the current project structure, patterns, and known limitations.

#### Scenario: JSON serialization updated
- **WHEN** reading the JSON serialization section
- **THEN** it references `utils.parse_json_field` instead of the old `startswith("[")` pattern

#### Scenario: Frontend state variables corrected
- **WHEN** reading the frontend state management section
- **THEN** it uses correct variable names (`api.token`, `state.user` instead of `window.apiToken`, `window.currentUser`)

#### Scenario: Known limitations list updated
- **WHEN** reading the known limitations section
- **THEN** the `startswith("[")` pattern is removed (already fixed)

#### Scenario: CURD + export reflected in known limitations
- **WHEN** reading the known limitations section
- **THEN** "题目不支持编辑" row is removed and "无数据导出" is updated to "仅支持题库 JSON 导出"

#### Scenario: questions.py module documented in routing table
- **WHEN** reading the backend routing table
- **THEN** `routers/questions.py` is listed with its CURD responsibility

### Requirement: API reference matches actual responses
`docs/api-reference.md` SHALL have request/response examples that match the actual API behavior.

#### Scenario: Options field serialization clarified
- **WHEN** reading the bank detail endpoint
- **THEN** `options` field is noted as raw database representation (unchanged)

#### Scenario: Multi-choice timeout documented
- **WHEN** reading the exam start endpoint
- **THEN** the `multi_choice` timeout parameter is documented

#### Scenario: CURD + export endpoints documented
- **WHEN** reading the API reference
- **THEN** includes `PUT /api/question-banks/:id`, `GET .../export`, `POST .../questions`, `PUT /api/questions/:id`, `DELETE /api/questions/:id`

### Requirement: PRD accurately describes implemented features
`docs/PRD.md` SHALL reflect the current feature set without referencing unimplemented or removed features.

#### Scenario: Feature list verified
- **WHEN** reading the PRD
- **THEN** each listed user story exists in the current codebase

#### Scenario: "不可修改题目" and "无数据导出" constraints updated
- **WHEN** reading the PRD constraints section
- **THEN** "不可修改题目" is replaced with "题目支持 CURD", "无数据导出" is replaced with "题库支持导出"

#### Scenario: Future direction items for implemented features marked
- **WHEN** reading the PRD future direction section
- **THEN** "题目编辑" and "批量导出" are marked as implemented

### Requirement: README matches current implementation
`README.md` SHALL have accurate feature list, API overview table, and configuration description.

#### Scenario: Feature list matches
- **WHEN** reading the feature list in README
- **THEN** all listed features exist in code and no missing features are implied

#### Scenario: Question CURD and export mentioned
- **WHEN** reading the README feature list
- **THEN** "题目编辑" and "题库导出/编辑" are listed

#### Scenario: API table accurate
- **WHEN** reading the API overview table
- **THEN** endpoint paths and descriptions match `main.py` router definitions

#### Scenario: Config section accurate
- **WHEN** reading the configuration section
- **THEN** environment variables and default values match `auth.py` and `database.py`
