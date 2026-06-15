## ADDED Requirements

### Requirement: JWT includes issued-at claim

Every JWT token issued by the system SHALL contain an `iat` (issued at) claim set to the time the token was created. Verification SHALL require the `iat` claim to be present.

#### Scenario: Token missing iat claim rejected

- **WHEN** a request includes a JWT without an `iat` claim
- **THEN** the token SHALL be rejected with HTTP 401 Unauthorized

#### Scenario: Token with iat claim accepted

- **WHEN** a request includes a JWT with a valid `iat` claim
- **THEN** the token SHALL pass the issued-at check and continue to other validations
