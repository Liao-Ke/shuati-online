## Purpose

Ensure automatic database migration execution during Docker container startup, so schema is always up to date before the application serves requests.

## Requirements

### Requirement: Docker container auto-runs migrations before app start

The Docker container entrypoint SHALL execute `alembic upgrade head` before starting the uvicorn application server, ensuring the database schema is always up to date.

#### Scenario: Fresh deployment creates schema

- **WHEN** a new container starts for the first time with an empty database volume
- **THEN** `alembic upgrade head` SHALL create all tables, followed by `uvicorn` starting normally

#### Scenario: Subsequent deployment applies new migrations

- **WHEN** a container restarts after a migration file was added to the image
- **THEN** `alembic upgrade head` SHALL apply only the new migration, then start the app
