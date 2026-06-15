## ADDED Requirements

### Requirement: CORS headers for cross-origin requests

The system SHALL include `CORSMiddleware` that controls `Access-Control-Allow-Origin` based on the `CORS_ORIGINS` environment variable. When `CORS_ORIGINS` is unset, all origins SHALL be allowed. When set to a comma-separated list, only those origins SHALL be permitted.

#### Scenario: Preflight OPTIONS request succeeds

- **WHEN** a cross-origin OPTIONS request is received
- **THEN** the response SHALL contain `Access-Control-Allow-Methods: *` and `Access-Control-Allow-Headers: *` with a 2xx status

#### Scenario: Request from allowed origin

- **WHEN** a request with `Origin: https://myapp.com` is received and `CORS_ORIGINS=https://myapp.com` is configured
- **THEN** the response SHALL include `Access-Control-Allow-Origin: https://myapp.com`

#### Scenario: Credentials allowed

- **WHEN** any cross-origin request is processed
- **THEN** the middleware SHALL be configured with `allow_credentials=True`
