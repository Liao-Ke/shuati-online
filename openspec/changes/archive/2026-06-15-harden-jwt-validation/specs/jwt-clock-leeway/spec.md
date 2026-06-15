## ADDED Requirements

### Requirement: JWT validation tolerates 60 seconds of clock drift

JWT `exp` (expiration) verification SHALL include a 60-second leeway to account for clock skew between the token issuer and verifier. Tokens expired by up to 60 seconds SHALL still be accepted.

#### Scenario: Token within leeway accepted

- **WHEN** a token has `exp` set to 55 seconds in the past
- **THEN** the token SHALL still be accepted

#### Scenario: Token beyond leeway rejected

- **WHEN** a token has `exp` set to 65 seconds in the past
- **THEN** the token SHALL be rejected with HTTP 401 Unauthorized
