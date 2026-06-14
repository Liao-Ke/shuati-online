## ADDED Requirements

### Requirement: Test file shall be discoverable by pytest
The integration test file SHALL be runnable via `pytest test_integration.py -v` and SHALL show collected test items, not zero.

#### Scenario: pytest discovery
- **WHEN** running `pytest test_integration.py -v`
- **THEN** at least 1 test is collected and executed

### Requirement: 28 existing test scenarios shall be preserved
All existing test logic (register, import, answer, review, etc.) SHALL remain in the refactored file.

#### Scenario: full regression
- **WHEN** running the refactored test
- **THEN** all 28 assertions from the original script pass

### Requirement: No sys.path hack
The test file SHALL NOT use `sys.path.insert` for module discovery.

#### Scenario: no sys.path import
- **WHEN** examining test file imports
- **THEN** there is no `sys.path.insert(0, '.')` statement
