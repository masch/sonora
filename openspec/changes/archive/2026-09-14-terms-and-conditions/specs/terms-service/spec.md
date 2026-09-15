# terms-service Specification

## Purpose

Provide backend endpoints and data persistence for serving the active legal terms version and capturing legally binding user consent records.

## Requirements

### Requirement: Serve Active Terms Version

The system MUST serve the currently active terms version ordered by `published_at DESC LIMIT 1`.

#### Scenario: Active terms queried successfully

- GIVEN the database has at least one published record in `terms_versions`
- WHEN a client sends a `GET` request to `/terms`
- THEN the system returns HTTP 200 with `version`, `title`, `content`, `contentHash`, and `publishedAt`
- AND the returned version matches the most recent `published_at` record

#### Scenario: No terms records available

- GIVEN the `terms_versions` table is empty
- WHEN a client sends a `GET` request to `/terms`
- THEN the system returns HTTP 404 with problem details type `not-found`

### Requirement: Record Legal Acceptance

The system MUST record an immutable audit entry in `terms_acceptances` ONLY when a client submits valid consent matching the single currently active terms version and content hash. Submissions for outdated, non-existent, or mismatched versions/hashes MUST be rejected.

#### Scenario: Valid acceptance submitted

- GIVEN an active terms record exists in `terms_versions` with version `V` and contentHash `H`
- WHEN a client sends a `POST` request to `/terms/accept` with matching `deviceId`, `version = V`, `contentHash = H`, and `platform`
- THEN the system inserts a record into `terms_acceptances` with the client's IP, User-Agent, and current timestamp
- AND returns HTTP 201 with `{ success: true }`

#### Scenario: Outdated or mismatched version rejected

- GIVEN an active terms record exists in `terms_versions` with version `V_active` and contentHash `H_active`
- WHEN a client sends a `POST` request to `/terms/accept` with an outdated version `V_old != V_active` or mismatched `contentHash != H_active`
- THEN the system returns HTTP 422 with problem details validation error indicating a terms version mismatch
- AND no record is inserted into `terms_acceptances`

#### Scenario: No active terms available for acceptance

- GIVEN the `terms_versions` table is empty
- WHEN a client sends a `POST` request to `/terms/accept`
- THEN the system returns HTTP 404 with problem details not-found error indicating no active terms are available
- AND no record is inserted into `terms_acceptances`

#### Scenario: Malformed request payload

- GIVEN a client sends a `POST` request to `/terms/accept` with missing or invalid schema fields
- WHEN validation runs
- THEN the system returns HTTP 422 with problem details validation error
- AND no record is inserted into `terms_acceptances`
