## ADDED Requirements

### Requirement: Structured stdout logging

The system SHALL include a centralized logging configuration that outputs to stdout with format `"%(asctime)s [%(levelname)s] %(name)s - %(message)s"`. Third-party library loggers (SQLAlchemy engine, passlib) SHALL be set to WARNING level.

#### Scenario: Application startup is logged

- **WHEN** the FastAPI application finishes initialization
- **THEN** an INFO-level log entry with `logger name "shuati"` SHALL appear on stdout

#### Scenario: Successful login is logged

- **WHEN** a user successfully authenticates via `POST /api/auth/login`
- **THEN** an INFO log entry SHALL contain the username but SHALL NOT contain the password

#### Scenario: Failed authentication is logged

- **WHEN** a JWT token is rejected by `get_current_user`
- **THEN** a WARNING log entry SHALL be emitted

#### Scenario: Exercise lifecycle is logged

- **WHEN** a user starts or finishes an exam
- **THEN** an INFO log entry SHALL contain the user ID and exam ID

#### Scenario: SQL queries not logged at INFO level

- **WHEN** the log level is INFO
- **THEN** SQLAlchemy engine SHALL NOT emit SQL query logs
