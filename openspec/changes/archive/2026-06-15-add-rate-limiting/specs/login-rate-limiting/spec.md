## ADDED Requirements

### Requirement: Login endpoint rate limited to 5 per minute

The system SHALL limit requests to `POST /api/auth/login` to 5 per minute per client IP address, using slolapi with in-memory storage.

#### Scenario: Normal login attempts succeed

- **WHEN** a client sends 3 login requests within one minute
- **THEN** all 3 requests SHALL receive normal responses (200 or 401 depending on credentials)

#### Scenario: Excessive login attempts are rejected

- **WHEN** a client sends 6 login requests within one minute
- **THEN** the 6th request SHALL be rejected with HTTP 429 Too Many Requests

#### Scenario: Rate limit resets after window

- **WHEN** a rate-limited client waits for one minute before retrying
- **THEN** a new login attempt SHALL be accepted and processed normally

#### Scenario: Rate limit error response is user-friendly

- **WHEN** a request is rate-limited
- **THEN** the response body SHALL contain a description indicating the rate limit has been exceeded
