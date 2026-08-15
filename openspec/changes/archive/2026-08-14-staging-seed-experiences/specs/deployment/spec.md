# Delta for Deployment

## MODIFIED Requirements

### Requirement: Makefile Automation

A Makefile MUST provide targets for deploy, migrate, and seed per environment. Seed targets MUST forward the `SEED_ENV` guard variable to the seed script, and the staging seed target MUST invoke the staging entry.

| Target                      | Action                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| `api-deploy-staging`        | Deploy Worker, set secrets for staging                                      |
| `api-deploy-production`     | Deploy Worker, set secrets for production                                   |
| `api-db-migrate-staging`    | Apply Drizzle migrations to staging Neon                                    |
| `api-db-migrate-production` | Apply Drizzle migrations to production Neon                                 |
| `api-db-seed-ci`            | Seed via base entry using `DATABASE_URL` from env (CI); forwards `SEED_ENV` |
| `api-db-seed-staging`       | Seed staging Neon via `seed-staging.ts` with `SEED_ENV=staging`             |
| `api-db-seed-production`    | Seed production Neon via base entry with `SEED_ENV=production`              |

(Previously: seed targets all invoked the single `seed.ts` with no environment guard.)

#### Scenario: Staging target runs staging entry

- GIVEN `DATABASE_URL_STAGING_CLEAN` configured
- WHEN `make api-db-seed-staging` runs
- THEN `seed-staging.ts` executes with `SEED_ENV=staging`

#### Scenario: Production target runs base entry

- GIVEN `DATABASE_URL_PRODUCTION_CLEAN` configured
- WHEN `make api-db-seed-production` runs
- THEN the base entry executes with `SEED_ENV=production`

### Requirement: Idempotent Staging Steps

Migrations and both seed entries MUST be idempotent. Running `make api-db-migrate-ci` and either seed entry (`seed.ts` or `seed-staging.ts`) on an already-migrated or already-seeded database MUST succeed without side effects.

(Previously: idempotency was required only for `make api-db-seed-ci` / `seed.ts`.)

#### Scenario: Re-running migration is safe

- GIVEN the staging DB already has all migrations applied
- WHEN `make api-db-migrate-ci` runs again
- THEN the command exits 0
- AND no schema changes occur

#### Scenario: Re-running base seed is safe

- GIVEN the staging DB already has base seed data
- WHEN `make api-db-seed-ci` runs again
- THEN the command exits 0
- AND no duplicate records are created

#### Scenario: Re-running staging seed is safe

- GIVEN the staging DB already has staging seed data
- WHEN the staging entry runs again
- THEN the command exits 0
- AND no duplicate `[PRUEBA]` records are created
