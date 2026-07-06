# Admin Database Backup Specification

## Purpose

Weekly encrypted backup of the production database to Cloudflare R2. Provides point-in-time recovery capability and off-site redundancy.

## Requirements

### Requirement: ADB-1 — Weekly cron schedule

The workflow MUST trigger on a weekly cron schedule. It MUST also support `workflow_dispatch` for on-demand backups (e.g., before a risky migration).

#### Scenario: Scheduled weekly backup

- GIVEN the cron schedule fires (weekly, off-peak hours)
- WHEN the backup workflow triggers
- THEN it connects to the production database
- AND runs pg_dump
- AND encrypts the output
- AND uploads to R2 with a dated key `backups/YYYY-MM-DD.sql.gz.age`

#### Scenario: On-demand pre-migration backup

- GIVEN a maintainer triggers `workflow_dispatch` before a schema migration
- WHEN the backup runs
- THEN it produces a full backup before the migration can proceed

### Requirement: ADB-2 — Encrypted pg_dump

The workflow MUST run `pg_dump` (or `pg_dump --format=custom` for compressed output) against the `DATABASE_URL` secret. The dump MUST be encrypted (e.g., using `age` or `gpg` with a stored public key) before upload. The encryption key MUST be stored as a GitHub secret.

#### Scenario: Backup succeeds

- GIVEN DATABASE_URL is configured and reachable
- WHEN pg_dump completes
- THEN the dump is compressed and encrypted
- AND uploaded to R2 with the dated key
- AND the workflow succeeds

#### Scenario: Database unreachable

- GIVEN DATABASE_URL is misconfigured or database is down
- WHEN pg_dump fails
- THEN the workflow fails immediately
- AND no R2 artifact is created (partial artifacts cleaned up)

### Requirement: ADB-3 — R2 upload with retention

The workflow MUST upload the encrypted backup to a designated R2 bucket. The key MUST follow the pattern `backups/{env}/YYYY-MM-DD.sql.gz.age`. R2 credentials (bucket name, access key, secret) MUST be stored as GitHub secrets. Backups SHOULD be retained indefinitely (R2 lifecycle can be configured separately).

#### Scenario: Upload failure

- GIVEN pg_dump and encryption succeed
- WHEN the R2 upload fails (network error, invalid credentials)
- THEN the workflow fails
- AND the local temporary backup file is cleaned up
- AND an alert should be surfaced (workflow failure notification)

### Requirement: ADB-4 — Notifications

The workflow SHOULD notify on failure (e.g., via GitHub commit status, or Slack webhook if configured). It SHOULD NOT notify on success (backups are routine, success noise is undesirable).

#### Scenario: Silent success, noisy failure

- GIVEN a backup completes successfully
- WHEN the workflow finishes
- THEN no notification is sent
- GIVEN a backup fails
- WHEN the workflow fails
- THEN a notification SHOULD be sent to the maintainers
