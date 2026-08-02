# Database Specification

## Purpose

Define the database schema changes required to support platform-aware device identity: adding a `platform` column to the `purchases` table and providing a one-time migration script to SHA-256 hash any raw device IDs that may exist in the database.

## Requirements

### Requirement: Add `platform` column to purchases table

The `purchases` table MUST have a new `platform` column with type `text NOT NULL`.

The column is added in two DDL steps (PostgreSQL requires a DEFAULT to satisfy NOT NULL on existing rows):

1. `ALTER TABLE sonora.purchases ADD COLUMN platform text NOT NULL DEFAULT 'android';`
2. `ALTER TABLE sonora.purchases ALTER COLUMN platform DROP DEFAULT;`

Step 1 fills all existing rows with `'android'`. Step 2 removes the DEFAULT so no new row can be inserted without an explicit platform value — the database enforces NOT NULL with no fallback.

In Drizzle ORM terms, the `purchases` table definition in `apps/api/src/db/schema.ts` MUST add:

```typescript
export const purchases = sonoraSchema.table('purchases', {
  // ... existing columns
  platform: text('platform').notNull(), // ADDED — no .default(), insert code always provides a value
  // ... existing columns (createdAt, updatedAt)
});
```

The column uses `text` (not `platformEnum`) to avoid coupling the database constraint to the application enum. The enum validation is enforced at the middleware layer (only `ios`, `android`, `web` are accepted from the header). This also avoids a migration that requires creating or altering a PostgreSQL enum type (which is a heavier DDL operation).

#### Migration SQL note

The Drizzle schema only represents the final state (`notNull()` with no default). The generated migration SQL must be manually adjusted to the two-step pattern above. The sequence:

1. `bun run db:generate` — produces: `ALTER TABLE sonora.purchases ADD COLUMN platform text NOT NULL;`
2. Edit the generated SQL: `ALTER TABLE sonora.purchases ADD COLUMN platform text NOT NULL DEFAULT 'android'; ALTER TABLE sonora.purchases ALTER COLUMN platform DROP DEFAULT;`
3. `bun run db:migrate` — executes the adjusted migration.

#### Scenario: New purchase record includes platform

- GIVEN a payment request with `X-Device-Platform: ios`
- WHEN the purchase record is inserted
- THEN the database row has `platform = 'ios'`

#### Scenario: No platform header, insert code defaults to 'unknown'

- GIVEN a payment request with no `X-Device-Platform` header
- WHEN `devicePlatform` is undefined
- AND the route handler defaults to `'unknown'`
- THEN the database row has `platform = 'unknown'`

#### Scenario: Existing records filled by temporary DEFAULT

- GIVEN the DDL migration adds `platform` with DEFAULT 'android'
- WHEN the column is added
- THEN every existing `purchases` row has `platform = 'android'`
- AND after the DEFAULT is dropped, no new row can be inserted without an explicit platform value

#### Scenario: Drizzle schema has no default

- GIVEN the final schema is `text('platform').notNull()`
- WHEN the DDL completes (both steps)
- THEN the database column has no DEFAULT
- AND any INSERT without an explicit platform value fails with a NOT NULL violation

### Requirement: Data migration script for existing device IDs

A one-time data migration script MUST be created at `apps/api/scripts/migrate-device-ids.ts`. This script identifies and SHA-256 hashes any device IDs in the database that are NOT already SHA-256 hashes (i.e., they are raw/unhashed values).

#### Detection logic

A value is considered "already hashed" (and left unchanged) if it matches `/^[0-9a-f]{64}$/i` — exactly 64 lowercase or uppercase hex characters.

A value is considered "raw/unhashed" if:

- It is not `NULL`
- It is not empty string
- It does NOT match the 64-char hex pattern

Raw values MUST be replaced with their SHA-256 hex digest in-place.

#### Tables and columns to scan

| Table                        | Column      |
| ---------------------------- | ----------- |
| `sonora.purchases`           | `device_id` |
| `sonora.experience_accesses` | `device_id` |

#### Script behavior

```typescript
// Pseudocode for the migration script
interface MigrationOptions {
  dryRun?: boolean;
  connectionString?: string;
}

interface MigrationResult {
  totalRows: number;
  rawRows: number;
  alreadyHashedRows: number;
  nullRows: number;
  updatedRows: number;
  errors: Array<{ row: unknown; error: string }>;
}
```

The script MUST:

1. Connect to the database using the `DATABASE_URL` env var (or a provided connection string).
2. Scan `purchases.device_id` and `experience_accesses.device_id`.
3. For each value that matches the raw/unhashed pattern, compute SHA-256 and queue an update.
4. If `dryRun` is true, log what WOULD be updated without executing.
5. If `dryRun` is false, execute the updates in a transaction.
6. Log a report of rows scanned, raw found, already-hashed found, nulls, and updated.

```typescript
// CLI usage
bun run apps/api/scripts/migrate-device-ids.ts          # live run
bun run apps/api/scripts/migrate-device-ids.ts --dry-run # dry run
```

#### Scenario: Dry run reports changes without applying

- GIVEN a database with some raw device IDs in `purchases.device_id`
- WHEN the script runs with `--dry-run`
- THEN it logs each raw device ID and its would-be hash
- AND no UPDATE statements are executed
- AND the exit code is 0

#### Scenario: Live run hashes raw device IDs

- GIVEN a database with raw device IDs `"device-abc"` and `"550e8400-e29b-41d4-a716-446655440000"` in `purchases.device_id`
- WHEN the script runs without `--dry-run`
- THEN `"device-abc"` is updated to its SHA-256 hash
- AND `"550e8400-e29b-41d4-a716-446655440000"` is updated to its SHA-256 hash
- AND already-hashed values are left unchanged
- AND null values are left unchanged
- AND the script logs the total updated count

#### Scenario: Already-hashed values are left unchanged

- GIVEN a database row with `purchases.device_id = "a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b"` (already a 64-char hex hash)
- WHEN the migration script runs
- THEN this row is NOT updated
- AND it is counted in `alreadyHashedRows`

#### Scenario: Error handling continues on failure

- GIVEN the script encounters a database error on one UPDATE
- WHEN the migration runs
- THEN the error is logged with the row identifier
- AND the script continues processing remaining rows (does NOT abort on a single failure)
- AND the error is counted in `errors`

### Requirement: Migration and deployment ordering

The deployment order MUST be:

1. **Database migration** (DDL): `bun run db:migrate` — adds `platform` column with two-step SQL (add NOT NULL DEFAULT 'android', then drop default). Existing records get 'android' from the temporary default.
2. **Data migration script**: `bun run scripts/migrate-device-ids.ts` — hashes any raw device IDs. Run with `--dry-run` first, verify, then live run.
3. **Backend deploy** — deploys the updated `injectDeviceId()` middleware (no longer hashing), CORS update, route handler changes (insert code always provides platform).
4. **Mobile deploy** — deploys the client-side hashing and `X-Device-Platform` header.

This ordering ensures:

- The column exists before the route tries to write to it.
- The temporary default fills existing records before any new request arrives.
- Raw device IDs are hashed before the server stops hashing them.
- Old clients sending raw values between steps 3 and 4 are caught by the migration.

#### Scenario: Old client between backend and mobile deploy

- GIVEN the backend is deployed (step 3) but mobile is not yet updated
- WHEN an old client sends a raw device ID
- THEN the server stores it as-is (no longer hashing)
- AND the migration script (step 2) would catch and hash it if re-run after the backend deploy

#### Rollback order

If rollback is needed:

1. **Revert mobile** first — old clients will send raw IDs, server stores them raw (no double-hash issue).
2. **Revert backend** second — restoring hashing middleware. New clients' already-hashed values would be double-hashed and lose access. To mitigate, after backend rollback, re-run the migration script to hash any raw IDs stored during the window.

#### Scenario: Backend rollback with new clients

- GIVEN the backend is rolled back to hashing middleware
- AND new clients are still sending pre-hashed values
- WHEN `injectDeviceId()` runs
- THEN the server double-hashes the already-hashed value
- AND the stored value differs from existing DB records
- AND the device loses access to purchases
- **(Mitigation: rollback mobile FIRST, then backend; or accept this risk and plan for a re-deploy)**
