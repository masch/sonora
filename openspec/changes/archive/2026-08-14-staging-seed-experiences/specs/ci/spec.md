# Delta for CI

## ADDED Requirements

### Requirement: Environment-Scoped Seeding in Deploy Workflows

Both API deploy workflows MUST pass `SEED_ENV` to their seed step. The staging workflow seed step MUST run the staging entry (`seed-staging.ts`) with `SEED_ENV=staging`. The production workflow seed step MUST run the base entry (`seed.ts`) with `SEED_ENV=production`. The production workflow MUST NOT invoke the staging entry.

#### Scenario: Staging CI seeds test data

- GIVEN the staging deploy workflow starts
- WHEN its seed step runs
- THEN `SEED_ENV=staging` is set
- AND the staging entry executes
- AND `[PRUEBA]` experiences land in the staging DB

#### Scenario: Production CI excludes test data

- GIVEN the production deploy workflow starts
- WHEN its seed step runs
- THEN `SEED_ENV=production` is set
- AND the base entry executes
- AND no `[PRUEBA]` experiences are inserted

#### Scenario: Missing SEED_ENV fails closed

- GIVEN a deploy workflow seed step without `SEED_ENV`
- WHEN the seed entry runs
- THEN the command exits non-zero
- AND the workflow fails

### Requirement: CI Seed Idempotency

The seed step in both deploy workflows MUST be idempotent: re-running a workflow against an already-seeded database MUST succeed without duplicate rows.

#### Scenario: Re-deploy seeds safely

- GIVEN a DB already seeded by a prior deploy
- WHEN the deploy workflow's seed step runs again
- THEN the step exits 0
- AND no duplicate rows are created
