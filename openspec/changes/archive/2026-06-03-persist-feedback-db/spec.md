# Delta for Feedback — Persistence Layer

This delta extends the [existing Feedback Specification](../../../specs/feedback/spec.md) with Postgres persistence. The external API contract (201/409) is unchanged — accepted feedback now persists in Postgres as the authoritative store.

## ADDED Requirements

### Requirement: Database Schema

The system MUST persist feedback in the `sonora` Postgres schema in a `feedback` table with columns: `id` (SERIAL PRIMARY KEY), `trip_id` (TEXT NOT NULL), `message` (TEXT NOT NULL), `idempotency_key` (TEXT NOT NULL UNIQUE), `created_at` (TIMESTAMPTZ DEFAULT NOW()). The `idempotency_key` UNIQUE constraint is the authoritative deduplication mechanism.

#### Scenario: Migration creates table

- GIVEN the database is empty
- WHEN `make api-db-migrate` runs
- THEN `sonora.feedback` exists with all columns and constraints

#### Scenario: Migration not applied

- GIVEN no migration has been applied
- WHEN POST /feedback is attempted
- THEN the server returns a 5xx error

### Requirement: Feedback Persistence

After returning 201, the system MUST insert a row into `sonora.feedback`. On UNIQUE constraint violation on `idempotency_key`, the system MUST return 409.

#### Scenario: Accepted feedback stored

- GIVEN valid feedback with unique `idempotencyKey`
- WHEN POST /feedback returns 201
- THEN a row exists in `sonora.feedback` matching the submitted data

#### Scenario: Duplicate via UNIQUE constraint

- GIVEN a `sonora.feedback` row with `idempotency_key` X
- WHEN POST /feedback arrives with `idempotencyKey` X
- THEN the server returns 409, regardless of KV state

### Requirement: Dual-Environment Runtime

The same Drizzle schema and handler code MUST work against Docker Postgres 17 (local) and Neon serverless Postgres (Workers).

#### Scenario: Local Docker Postgres

- GIVEN the app runs via `@hono/node-server` with a `pg` Pool
- WHEN feedback is accepted
- THEN data persists in local Docker Postgres 17

#### Scenario: Workers + Neon

- GIVEN the app runs on Cloudflare Workers with `@neondatabase/serverless`
- WHEN feedback is accepted
- THEN data persists in Neon

### Requirement: Idempotency Key Source of Truth

The database UNIQUE constraint on `idempotency_key` SHALL be the authoritative deduplication mechanism. The KV check MAY be used as a fast-path optimization but MUST NOT be the sole arbiter.

#### Scenario: KV miss, DB hit

- GIVEN KV is empty or unavailable for idempotencyKey X
- WHEN a row with `idempotency_key` X already exists in `sonora.feedback`
- THEN POST /feedback with X returns 409

#### Scenario: KV hit prevents DB write

- GIVEN KV contains idempotencyKey X (from a prior accepted submission)
- WHEN POST /feedback with X arrives
- THEN the server returns 409 WITHOUT attempting a DB insert
