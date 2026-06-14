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

### Requirement: API reference matches actual responses
`docs/api-reference.md` SHALL have request/response examples that match the actual API behavior.

#### Scenario: Options field serialization clarified
- **WHEN** reading the bank detail endpoint
- **THEN** `options` field is noted as raw database representation (unchanged)

#### Scenario: Multi-choice timeout documented
- **WHEN** reading the exam start endpoint
- **THEN** the `multi_choice` timeout parameter is documented

### Requirement: PRD accurately describes implemented features
`docs/PRD.md` SHALL reflect the current feature set without referencing unimplemented or removed features.

#### Scenario: Feature list verified
- **WHEN** reading the PRD
- **THEN** each listed user story exists in the current codebase

### Requirement: README matches current implementation
`README.md` SHALL have accurate feature list, API overview table, and configuration description.

#### Scenario: Feature list matches
- **WHEN** reading the feature list in README
- **THEN** all listed features exist in code and no missing features are implied

#### Scenario: API table accurate
- **WHEN** reading the API overview table
- **THEN** endpoint paths and descriptions match `main.py` router definitions

#### Scenario: Config section accurate
- **WHEN** reading the configuration section
- **THEN** environment variables and default values match `auth.py` and `database.py`
