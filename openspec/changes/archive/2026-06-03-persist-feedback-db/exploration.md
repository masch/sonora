# Exploration: persist-feedback-db

## Summary

Issue #62 transitions the feedback API from KV-only storage (idempotency dedup) to full persistence in Postgres. Locally it uses `@hono/node-server` + `pg` + Docker Postgres 17; in production it runs on Cloudflare Workers with `@neondatabase/serverless` (Neon's HTTP driver for edge). KV stays for idempotency checks, but the feedback content (`tripId`, `message`, `idempotencyKey`, `createdAt`) goes into a `feedback` table. This requires a new database layer, a new local server entry point, migrations via Drizzle Kit, testing infrastructure, and Docker Compose for local Postgres.

## Current State

### Feedback API Handler

File: `api/src/index.ts` (100 lines)

- **Single-file Hono app**. No dependency injection — `saveFeedback` is NOT injected. The handler reads `c.env.FEEDBACK_STORE` (KV) directly and `c.env.FEEDBACK_MAX_LENGTH` for config.
- Validates body manually (no Zod): checks `tripId`, `message`, `idempotencyKey`, `createdAt` as required non-empty strings.
- KV dedup: checks `env.FEEDBACK_STORE.get(idempotencyKey)`, returns `409` if found, stores with 30-day TTL if not.
- **Does NOT persist feedback content anywhere** — just returns `201 { status: 'ok' }` after KV dedup.
- Env type is defined inline: `FEEDBACK_STORE?: KVNamespace; FEEDBACK_MAX_LENGTH?: string`
- Handler is exported as `default app` (not wrapped in a factory).

### wrangler.toml

File: `api/wrangler.toml`

```toml
name = "sonora-api"
main = "src/index.ts"
compatibility_date = "2025-02-04"

# KV binding for idempotency — commented out (requires namespace creation)
# kv_namespaces = [{ binding = "FEEDBACK_STORE", id = "<your-namespace-id>" }]

[vars]
FEEDBACK_MAX_LENGTH = "1000"
```

- Uses TOML format (not JSONC).
- `compatibility_date` is **old**: 2025-02-04. Needs updating.
- No `nodejs_compat` flag (will be needed for `pg` driver).
- No Hyperdrive, D1, or other bindings.
- KV binding is commented out.

### package.json (api/)

```json
{
  "dependencies": {
    "hono": "^4.7.5"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250204.0",
    "vitest": "^3.0.0",
    "wrangler": "^4.0.0"
  }
}
```

**Missing deps** (all need `bun add`):

- `drizzle-orm` — ORM
- `drizzle-kit` (dev) — migration generation
- `pg` — PostgreSQL driver (local)
- `@neondatabase/serverless` — Neon HTTP driver (Workers)
- `@hono/node-server` — Local Node.js server
- `@types/node` (dev) — Types for Node.js server

### tsconfig.json (api/)

Standard Workers-compatible TS config. No changes needed except possibly adding `node` types for local server.

### Tests

File: `api/src/__tests__/feedback.test.ts` (138 lines, 6 tests)

- Uses `app.request()` for integration-style testing without a server.
- Tests: empty body (422), missing fields (422), empty message (422), valid feedback (201), duplicate without KV (201), duplicate with KV (409 via `app.fetch` with mock Env), message over 1000 chars (422).
- **No database layer tested** — all tests run without DB.
- No Vitest config file exists (uses defaults).

### SDD Archive (PR #61)

All artifacts from `post-trip-offline-queue` are archived at:
`openspec/changes/archive/2026-06-02-post-trip-offline-queue/`

The spec was synced to `openspec/specs/feedback/spec.md` (7 requirements, 13 scenarios). The archive report notes 4 warnings, but none block the current change.

### Docker / Compose

**No docker-compose.yml or Dockerfile exists anywhere in the project** (root or `api/`).

### Env Files

- Root `.env` has `EXPO_TOKEN`, `SOCKET_SECURITY_API_KEY`, `SOCKET_CLI_ORG_SLUG` — no database-related vars.
- Root `.env_example` mirrors the same 3 vars.
- No `.dev.vars` in `api/`.
- No `.env` in `api/`.

### Makefile API Targets

```
api-install    → cd api && bun install
api-dev        → cd api && bun run dev (wrangler dev)
api-test       → cd api && bun run test (vitest run)
api-typecheck  → cd api && bun run typecheck (tsc --noEmit)
api-deploy     → cd api && bun run deploy (wrangler deploy)
api-validate   → api-test + api-typecheck
validate       → format + test + lint + typecheck + api-validate + gga
```

### OpenSpec Config

Mode is **hybrid** (OpenSpec files + Engram). Strict TDD is enabled. Testing runner is Jest for main app, but `api/` uses Vitest.

## Full File Manifest

### Files to Modify

| File                                 | Action     | What to Change                                                                                                                                                                                     |
| ------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/src/index.ts`                   | **Modify** | Refactor handler to accept `saveFeedback` as injected dependency. Database-backed save with KV fallback for idempotency.                                                                           |
| `api/wrangler.toml`                  | **Modify** | Add `compatibility_flags: ["nodejs_compat"]`, update `compatibility_date`, add `HYPERDRIVE` binding (or Neon connection string via secrets), remove commented-out KV binding or leave as optional. |
| `api/package.json`                   | **Modify** | Add `drizzle-orm`, `pg`, `@neondatabase/serverless`, `@hono/node-server`, `drizzle-kit` (dev), `@types/node` (dev). Add scripts: `dev:local`, `db:generate`, `db:migrate`, `db:seed`.              |
| `Makefile`                           | **Modify** | Add `api-db-up`/`api-db-down` for Docker Compose. Update `api-dev` to support local mode. Add `api-db-generate`/`api-db-migrate` for Drizzle Kit.                                                  |
| `.env_example`                       | **Modify** | Add `DATABASE_URL` placeholder.                                                                                                                                                                    |
| `api/src/__tests__/feedback.test.ts` | **Modify** | Add tests for DB persistence layer. Possibly add integration tests that run against Docker Postgres (or mock the db module).                                                                       |

### Files to Create

| File                      | Purpose                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `api/src/db/schema.ts`    | Drizzle schema: `feedback` table with `id`, `trip_id`, `message`, `idempotency_key`, `created_at`            |
| `api/src/db/index.ts`     | Pool/client factory — returns `pg` Pool for local, `@neondatabase/serverless` `neon` HTTP client for Workers |
| `api/src/db/seed.ts`      | Optional seed data for local development                                                                     |
| `api/src/server.local.ts` | Entry point: `@hono/node-server` + `pg` pool, imports the Hono app with DB-wired handler                     |
| `api/docker-compose.yml`  | Postgres 17 service with port mapping, volume, env vars                                                      |
| `api/drizzle.config.ts`   | Drizzle Kit configuration pointing to `src/db/schema.ts`, output to `api/migrations/`                        |
| `api/migrations/`         | Generated migration SQL files from `drizzle-kit generate`                                                    |
| `api/.dev.vars`           | Local secrets: `DATABASE_URL=postgres://...` (add to `.gitignore`)                                           |
| `api/.gitignore`          | Add to `api/` if not present (for `.dev.vars`, `node_modules`, `.wrangler`)                                  |
| `api/vitest.config.ts`    | May need to configure Vitest for DB integration tests (if not mocking)                                       |

## Dependencies to Add

Run these in `api/`:

```bash
bun add drizzle-orm
bun add pg
bun add @neondatabase/serverless
bun add @hono/node-server
bun add -D drizzle-kit
bun add -D @types/node
```

## Schema & Migration Plan

### Drizzle Schema (`api/src/db/schema.ts`)

```typescript
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  tripId: text('trip_id').notNull(),
  message: text('message').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Migration Workflow

1. Start local Postgres: `docker compose up -d` (from `api/`)
2. Generate migration: `bunx drizzle-kit generate`
3. Apply migration: `bunx drizzle-kit migrate`
4. The generated SQL creates the `feedback` table with the schema above.

**Note**: `drizzle-kit generate` does NOT need a live database — it generates SQL from the schema file alone. Only `migrate` and `studio` need a database connection.

## Architecture Decisions to Make

### 1. Dependency Injection: How to inject `saveFeedback`

**Current**: Handler is a plain `app.post('/feedback', async (c) => {...})` that reads `c.env` directly.

**Options**:

| Approach                        | Description                                                          | Pros                                         | Cons                                                  |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| A. Factory function             | Export `createApp(db)` that returns a Hono app with db wired in      | Clean separation, testable                   | More refactoring, changes existing exports            |
| B. c.set / middleware injection | Use `c.set('db', dbClient)` in middleware, read in handler           | Works with existing pattern, minimal changes | c.set is untyped by default, need to extend Env types |
| C. Module-level singleton       | `db/index.ts` exports a singleton that checks `process.env` / global | Simple, no refactoring                       | Not testable, global state anti-pattern on Workers    |

**Recommendation**: **Approach B** with Env type extension. The Hono `Env` type already has `Bindings` — add `Variables` for the db client. The handler keeps its shape, and the db is injected via a middleware that either:

- In local mode: creates a pg Pool
- In Workers mode: reads the Neon HTTP client from `c.env.DATABASE` (via Hyperdrive binding or Neon connection string)

### 2. Dual-Environment db/index.ts Structure

Both `pg` and `@neondatabase/serverless` use the same `drizzle-orm` query API, but the pool/client creation differs:

- **Local (`@hono/node-server` + `pg`)**: `new Pool({ connectionString })` → `drizzle(pool, { schema })`
- **Workers (`@neondatabase/serverless`)**: `neon(connectionString)` (HTTP client) → `drizzle(client, { schema })`

The factory should detect the environment. Options:

| Approach                      | Description                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| A. env var switch             | `if (process.env.DATABASE_URL)` → pg Pool, else fallback. Won't work in Workers where `process.env` doesn't exist the same way |
| B. Explicit factory           | `db.ts` exports `createDbClient(adapter: 'pg'                                                                                  | 'neon', connectionString: string)` |
| C. Middleware-per-environment | Local server has middleware that sets `db`, Workers route handler reads binding                                                |

**Recommendation**: **Approach B** — explicit factory called from the entry point. `server.local.ts` creates a pg Pool and passes it. Workers handler reads the Hyperdrive binding (or Neon connection string from secret) and creates the Neon client at request time or module level.

### 3. Connection String / Secrets Management

| Environment     | Mechanism                                        | Value                                                         |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Local dev       | `api/.dev.vars`                                  | `DATABASE_URL=postgres://sonora:sonora@localhost:5432/sonora` |
| Workers prod    | `wrangler secret put DATABASE_URL`               | Neon project connection string (HTTP, `postgres://...`)       |
| Workers staging | `wrangler secret put DATABASE_URL --env staging` | Separate Neon database                                        |

Alternatively, **Hyperdrive** is the recommended approach for Postgres on Workers (per Workers Best Practices skill). Hyperdrive provides connection pooling, query caching, and a single binding. But Hyperdrive requires a non-free plan and setup.

**Recommendation**: Start with `DATABASE_URL` secret for MVP. Add Hyperdrive as an optimization later. The db factory can accept either.

### 4. How Tests Should Work

**Current**: 6 unit tests using `app.request()` — no DB.

**Options**:

| Approach                   | Description                                 | Pros                  | Cons                                        |
| -------------------------- | ------------------------------------------- | --------------------- | ------------------------------------------- |
| A. Mock `db/index.ts`      | Vitest mock of the db module                | Fast, no infra needed | Tests don't verify actual SQL               |
| B. Integration with Docker | Start Docker Postgres, run tests against it | Real DB behavior      | Slower, needs Docker running, CI complexity |
| C. In-memory SQLite        | Use `better-sqlite3` with Drizzle in tests  | Fast, real SQL        | Different dialect — schema drift risk       |

**Recommendation**: **Approach A** (mocking) for unit tests, plus **Approach B** (Docker) for a subset of integration tests in CI. The unit tests mock `db.insert().values().returning()` and verify the handler behavior (201 on success, 409 on duplicate). A separate `api/src/__tests__/feedback.db.integration.test.ts` tests the actual SQL against Docker Postgres, gated behind a `RUN_INTEGRATION_TESTS` env var.

### 5. KV vs Postgres for Idempotency

The issue says "KV stays for idempotency, feedback content goes into Postgres". This means:

- **KV**: Check `idempotencyKey` existence (fast, 30-day TTL)
- **Postgres**: Insert the feedback row (the `idempotency_key` column has a UNIQUE constraint as safety net)

The flow becomes:

1. Validate body
2. (Optional) Check KV for idempotencyKey → 409 if exists
3. Insert into Postgres via Drizzle
4. If UNIQUE violation on `idempotency_key`, treat as duplicate (409)
5. Store idempotencyKey in KV (with TTL)
6. Return 201

The KV check is an optimization to avoid a DB write on duplicate. The UNIQUE constraint on Postgres is the source of truth.

### 6. nodejs_compat and Compatibility Date

The `pg` driver uses Node.js APIs. For Workers:

- `pg` itself won't work in Workers (needs TCP sockets). That's why `@neondatabase/serverless` is used — it uses Neon's HTTP API.
- `@neondatabase/serverless` requires the `nodejs_compat` compatibility flag.
- Update `compatibility_date` to at least `2025-09-01` or later.

**Recommendation**: Set `compatibility_flags = ["nodejs_compat"]` in wrangler.toml.

## Risks & Constraints

### 1. Workers + Neon: HTTP vs WebSocket mode

`@neondatabase/serverless` has two modes:

- **HTTP mode** (default): Uses `fetch()` — works natively in Workers. No WebSocket needed.
- **WebSocket mode**: Uses `ws` package — requires `nodejs_compat` and WebSocket support.

For Workers, **HTTP mode** is the right choice. It's slightly slower than a persistent connection but compatible with the edge runtime.

### 2. `node:async_hooks` compatibility

Drizzle ORM does NOT use `async_hooks`. This is a Prisma concern, not Drizzle. No risk here.

### 3. drizzle-kit generate needs a live database

**Correction**: `drizzle-kit generate` (or `drizzle-kit generate --dialect postgresql`) actually does NOT need a live database — it generates SQL from the schema file alone. Only `drizzle-kit migrate` and `drizzle-kit studio` need a connection. However, for the `dialect: 'postgresql'` config in `drizzle.config.ts`, we still need `dbCredentials.url` defined even for `generate` (Drizzle Kit validates it). We can provide a local Docker Postgres URL or use a dummy value with a `.env` check.

**Workaround**: Set `DATABASE_URL` in `api/.dev.vars` and load it via a script before running `generate`. Or use `--config` with env overrides.

### 4. Free-tier Neon limits

Neon's free tier includes:

- 500 MB of storage
- 100 compute hours per month
- 7-day history for point-in-time restore

For feedback data (text only), 500 MB is extremely generous. No risk here for MVP.

### 5. No existing Docker/Compose infrastructure

The project has zero Docker infrastructure. The team may not have Docker installed on dev machines. The docker-compose.yml should be optional — provide a Makefile target that warns if Docker isn't available.

### 6. `server.local.ts` changes the dev workflow

Currently `api-dev` runs `wrangler dev`. With the local server path, there are two modes:

- `bun run dev:local` → `tsx src/server.local.ts` (starts Node.js HTTP server with Postgres)
- `bun run dev` → `wrangler dev` (Workers mode, no local Postgres)

The Makefile needs to distinguish between them.

## Ready for Proposal

**Yes**. The exploration is complete. Key decisions the orchestrator should take to the proposal:

1. **Dependency injection**: Option B (c.set middleware with Env type extension) — minimal refactoring
2. **db factory**: Option B (explicit `createDbClient(adapter, connectionString)`)
3. **Secrets**: `DATABASE_URL` via `.dev.vars` locally, `wrangler secret put` for prod
4. **Testing**: Mock-based unit tests + optional Docker-based integration tests
5. **KV role**: Idempotency optimization (fast path) — UNIQUE constraint on `idempotency_key` is the source of truth
6. **compatibility_flags**: `["nodejs_compat"]` needed, update `compatibility_date`
7. **Two dev modes**: Local (Node.js + pg) vs Workers (wrangler dev). The Makefile needs both.
