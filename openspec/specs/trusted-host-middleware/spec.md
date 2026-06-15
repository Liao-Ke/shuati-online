## Purpose

Validate incoming Host headers to prevent Host header injection attacks, allowing only trusted hostnames to reach the application.

## Requirements

### Requirement: Host header validation

The system SHALL include `TrustedHostMiddleware` to reject requests with unauthorized `Host` headers. When `ALLOWED_HOSTS` environment variable is set to a comma-separated list, only requests whose `Host` header matches one of those values SHALL be accepted. When unset, all hosts SHALL be allowed.

#### Scenario: Unauthorized Host header rejected

- **WHEN** `ALLOWED_HOSTS=myapp.com` is configured and a request arrives with `Host: evil.com`
- **THEN** the response SHALL be HTTP 400 Bad Request

#### Scenario: Valid Host header accepted

- **WHEN** `ALLOWED_HOSTS=myapp.com,www.myapp.com` is configured and a request arrives with `Host: myapp.com`
- **THEN** the request SHALL be processed normally
