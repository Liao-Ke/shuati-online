## ADDED Requirements

### Requirement: All timestamps use naive UTC

All `Column(DateTime, default=...)` in SQLAlchemy models SHALL use a shared `utcnow()` utility function that returns `datetime.now(timezone.utc).replace(tzinfo=None)`. No code SHALL call the deprecated `datetime.datetime.utcnow()`.

#### Scenario: New User record gets UTC timestamp

- **WHEN** a new User is created without specifying `created_at`
- **THEN** `created_at` SHALL be set to the current UTC time as a timezone-naive datetime

#### Scenario: QuestionBank update refreshes timestamp

- **WHEN** a QuestionBank record is modified
- **THEN** `updated_at` SHALL be set to the current UTC time

#### Scenario: JWT expiration uses UTC

- **WHEN** an access token is created
- **THEN** `exp` and `iat` claims SHALL be calculated from `datetime.now(timezone.utc).replace(tzinfo=None)`

#### Scenario: No DeprecationWarning from utcnow

- **WHEN** running the application on Python 3.12+
- **THEN** no `DeprecationWarning` SHALL be emitted for `datetime.utcnow()` usage

### Requirement: Shared utcnow utility in models.py

The project SHALL define a single `utcnow()` function in `models.py` that all modules can import, avoiding duplicated `datetime.now(timezone.utc).replace(tzinfo=None)` calls.

#### Scenario: routers can import utcnow

- **WHEN** a router module needs the current UTC time
- **THEN** it SHALL be able to `from models import utcnow` and use it directly
