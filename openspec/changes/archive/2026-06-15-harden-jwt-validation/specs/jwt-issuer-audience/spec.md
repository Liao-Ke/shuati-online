## ADDED Requirements

### Requirement: JWT includes issuer and audience claims

Every JWT token issued by the system SHALL contain `iss` (issuer) set to `"shuati-online"` and `aud` (audience) set to `"shuati-api"`. Token verification SHALL reject tokens where these claims do not match.

#### Scenario: Token with correct issuer and audience accepted

- **WHEN** a request includes a JWT with `iss: "shuati-online"` and `aud: "shuati-api"`
- **THEN** the token SHALL pass verification and the user SHALL be authenticated

#### Scenario: Token from foreign issuer rejected

- **WHEN** a request includes a JWT signed with HS256 but with `iss: "other-service"`
- **THEN** the token SHALL be rejected with HTTP 401 Unauthorized

#### Scenario: Token with wrong audience rejected

- **WHEN** a request includes a JWT with `iss: "shuati-online"` but `aud: "other-api"`
- **THEN** the token SHALL be rejected with HTTP 401 Unauthorized
