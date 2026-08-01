# Spec: Admin HttpOnly Cookie Security & Session Management

### Requirement: Admin Session Endpoints

The API MUST provide session management endpoints.

#### Scenario: Session creation

- Given a valid admin key
- When POST /api/translations/session is called
- Then set-cookie admin_session is returned with HttpOnly.

#### Scenario: Session deletion

- Given an active session
- When DELETE /api/translations/session is called
- Then cookie is cleared.
