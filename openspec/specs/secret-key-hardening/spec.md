## Purpose

消除硬编码默认 SECRET_KEY，确保生产环境强制配置密钥，开发环境自动生成随机密钥。

## Requirements

### Requirement: SECRET_KEY shall never use a hardcoded default

The system SHALL generate a cryptographically random SECRET_KEY using `secrets.token_hex(32)` in development environments when no `SECRET_KEY` environment variable is set. In production, `SECRET_KEY` MUST be injected via environment variable or Docker Compose.

#### Scenario: Production deployment without SECRET_KEY fails fast

- **WHEN** `docker compose up` is executed without `SECRET_KEY` set in the environment
- **THEN** Docker Compose SHALL refuse to start with an error message indicating `SECRET_KEY` is required

#### Scenario: Development auto-generates and persists random key

- **WHEN** the application starts with no `SECRET_KEY` environment variable and is NOT running in production mode
- **THEN** a 32-byte hex key SHALL be generated via `secrets.token_hex(32)`, persisted to a local `.secret_key` file, and used as the signing key
- **AND** on subsequent restarts, the persisted key SHALL be reused so that previously issued JWTs remain valid

#### Scenario: Persisted key file is not committed to version control

- **WHEN** the `.secret_key` file exists in the project directory
- **THEN** it SHALL be listed in `.gitignore` to prevent accidental commits

#### Scenario: Environment variable takes precedence

- **WHEN** `SECRET_KEY` is set in the environment
- **THEN** the provided value SHALL be used regardless of any other defaults

### Requirement: JWT signing key must not leak via error messages

The system SHALL NOT expose the SECRET_KEY value in any error message, log output, or HTTP response.

#### Scenario: Authentication error does not leak key

- **WHEN** a JWT verification fails for any reason
- **THEN** the error response SHALL only contain a generic message like "无效的 token" without any key material
