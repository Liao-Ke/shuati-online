## ADDED Requirements

### Requirement: Alembic initialized with project metadata

The project SHALL include an Alembic configuration (`alembic.ini` and `alembic/env.py`) that references `Base.metadata` from the project's models and reads the database URL from `SQLALCHEMY_DATABASE_URL` in `database.py`.

#### Scenario: Autogenerate detects current schema

- **WHEN** `alembic revision --autogenerate -m "initial schema"` is run
- **THEN** a migration file SHALL be created in `alembic/versions/` capturing the current table definitions from all models

#### Scenario: Upgrade creates all tables

- **WHEN** `alembic upgrade head` is run against an empty database
- **THEN** tables `users`, `question_banks`, `questions`, `exam_records`, `answer_records`, `review_records` SHALL be created with correct columns and constraints

#### Scenario: Idempotent upgrade

- **WHEN** `alembic upgrade head` is run against a database already at the latest revision
- **THEN** the command SHALL exit successfully without errors
