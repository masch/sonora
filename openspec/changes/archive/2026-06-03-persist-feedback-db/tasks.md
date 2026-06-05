# Tasks: Persist Feedback in Postgres

## Review Workload Forecast

| Field                   | Value                                        |
| ----------------------- | -------------------------------------------- |
| Estimated changed lines | ~330–370                                     |
| 400-line budget risk    | **Low** (under by ~30–70)                    |
| Chained PRs recommended | **No** (cohesive change, single atomic unit) |
| Delivery strategy       | ask-on-risk                                  |

**Decision needed before apply**: Yes (see PREREQS below)

### Risk Items

| Risk                                                     | Impact            | Mitigation                                                              |
| -------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `@neondatabase/serverless` import resolution in Wrangler | Blocked Neon path | Test with wrangler dev first; fallback: use `pg` Pool via nodejs_compat |

### Prerequisites (decision needed)

1. **Confirm project uses `bun`** for the `api/` directory — the Makefile's `api-install` runs `bun install` from the root but `api/package.json` has no `bun.lock` yet. If switching to npm/pnpm, adjust scripts and `drizzle.config.ts` accordingly.
2. **Confirm Docker availability** — `api/docker-compose.yml` requires `docker compose` locally.
3. **Confirm Neon project exists** or one should be created for `NEON_DATABASE_URL`.

---

## Task 1: Project scaffolding — deps, Docker, config files

- [x] Completed

**Goal**: Install all new dependencies and wire up infrastructure config so the rest can build.

### Files to Create

| File                     | Purpose                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| `api/docker-compose.yml` | Postgres 17 service on port 5432 with `sonora` DB                               |
| `api/drizzle.config.ts`  | Drizzle Kit pointing at `schema: "./src/db/schema.ts"`, `dialect: "postgresql"` |
| `api/.dev.vars`          | `DATABASE_URL=postgres://sonora:sonora@localhost:5432/sonora`                   |

### Files to Modify

| File               | Changes                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/package.json` | **deps**: `drizzle-orm`, `pg`, `@neondatabase/serverless`, `@hono/node-server`                                                                                             |
|                    | **devDeps**: `drizzle-kit`, `@types/pg`, `@types/node`, `tsx` (for local server)                                                                                           |
|                    | **scripts**: `"dev:local": "tsx src/server.local.ts"`, `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:studio": "drizzle-kit studio"` |
| `api/.gitignore`   | Add `.dev.vars` and `migrations/`                                                                                                                                          |
| `.env_example`     | Add `DATABASE_URL=postgres://sonora:sonora@localhost:5432/sonora`                                                                                                          |

### Verification

```bash
cd api && bun install
bun run typecheck  # should pass with no type changes yet
```

**Implementation tips**:

- `drizzle.config.ts` must use `import type { Config } from 'drizzle-kit'` with `satisfies Config`
- Docker Compose: use the official `postgis/postgis:17-3.5` image (or vanilla `postgres:17-alpine`), map port 5432, set `POSTGRES_USER=sonora`, `POSTGRES_PASSWORD=sonora`, `POSTGRES_DB=sonora`
- The `.dev.vars` format is one `KEY=VALUE` per line (Wrangler convention)

---

## Task 2: Drizzle schema — `api/src/db/schema.ts`

- [x] Completed

**Goal**: Define the `sonora.feedback` table as the single source of truth for the data model.

### Files to Create

| File                   | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `api/src/db/schema.ts` | `pgSchema('sonora')` → `feedback` table with all columns and constraints |

### Schema Contract

```typescript
import { pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const sonoraSchema = pgSchema('sonora');

export const feedback = sonoraSchema.table('feedback', {
  id: serial('id').primaryKey(),
  tripId: text('trip_id').notNull(),
  message: text('message').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Inferred types
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
```

### Verification

```bash
bun run typecheck  # no errors
npx drizzle-kit generate  # should produce migration SQL in migrations/
```

**Implementation tips**:

- `unique()` on `idempotencyKey` creates the UNIQUE constraint — this is the authoritative dedup mechanism per the spec
- `pgSchema` scopes the table to the `sonora` schema (Postgres-specific), avoiding namespace collisions
- Use `timestamp('created_at', { withTimezone: true })` for timezone-aware timestamps

---

## Task 3: DB client factory — `api/src/db/index.ts`

- [x] Completed

**Goal**: Provide a `createDbClient` factory that returns a Drizzle instance for either `pg` (local) or `@neondatabase/serverless` (Workers) adapter.

### Files to Create

| File                  | Purpose                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `api/src/db/index.ts` | `createDbClient(adapter, connectionString)` factory + `DbClient` type |

### Interface

```typescript
import { drizzle, type NeonHttpDatabase, type NodePgDatabase } from 'drizzle-orm/*';
import * as schema from './schema';

type DbClient = NeonHttpDatabase<typeof schema> | NodePgDatabase<typeof schema>;

export function createDbClient(
  adapter: 'pg',
  poolOrConnection: Pool | string,
): NodePgDatabase<typeof schema>;

export function createDbClient(
  adapter: 'neon',
  connectionString: string,
): NeonHttpDatabase<typeof schema>;
```

### Verification

```bash
bun run typecheck  # should infer overloads correctly
# Manual smoke test:
bun -e "
  import { createDbClient } from './src/db';
  console.log('Factory exported:', typeof createDbClient);
"
```

**Implementation tips**:

- Use overload signatures for return-type correctness
- For `'pg'`: accept a `Pool` instance (caller creates it) — this keeps the factory focused on Drizzle, not pool management
- For `'neon'`: use `neon(connectionString)` HTTP client from `@neondatabase/serverless` and pass to `drizzle()`
- Import schema with `import * as schema from './schema'` to pass the entire schema object to drizzle

---

## Task 4: Wire DB into Hono handler — `api/src/index.ts`

- [x] Completed

**Goal**: Make the `POST /feedback` handler persist accepted feedback to Postgres via Drizzle, with the UNIQUE constraint as authoritative dedup.

### Files to Modify

| File               | Changes                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `api/src/index.ts` | Add `DbClient` to `Variables`, inject middleware, refactor handler |

### Detailed Changes

1. **Add imports**: `createDbClient`, `DbClient`, `feedback` schema, `eq`, `NeonHttpDatabase`, `NodePgDatabase`
2. **Add to `Env`**: `DATABASE_URL?: string`, `DB_ADAPTER?: 'neon'`
3. **Define `Variables`** interface with `db: DbClient` (optional)
4. **Add module-level** `let _dbClient: DbClient | null = null` + `export function setDbClient(db: DbClient | null) { _dbClient = db; }`
5. **Add middleware** to `app.use('*')`:
   - If `_dbClient` is already set, call `c.set('db', _dbClient)`
   - Else if `c.env.DATABASE_URL`, lazy-init with `createDbClient('neon', ...)` and cache in `_dbClient`
   - Call `await next()`
6. **Refactor `POST /feedback` handler**:
   - Keep all existing validation and KV dedup logic
   - After KV check (and before returning 201), attempt `db.insert(feedback).values(...)`
   - Wrap insert in try/catch:
     - On `UNIQUE constraint violation` error (check error message), return 409
     - On other error, throw (let `onError` handle it as 500)
   - On success, return 201
7. **Add error type guard** for Postgres unique violation (check for `'23505'` code in the error object)

### Handler Flow (Post-Change)

```
POST /feedback
  ├─ validate body → 422 if invalid
  ├─ check FEEDBACK_MAX_LENGTH → 422 if too long
  ├─ KV fast-path check → 409 if found
  ├─ DB insert via Drizzle
  │   ├─ UNIQUE violation → 409 (authoritative dedup)
  │   └─ Other error → rethrow (→ 500)
  └─ return 201
```

### Verification

```bash
bun run typecheck  # no errors
bun run test       # existing tests should still pass (no DB = no-op)
```

**Implementation tips**:

- The Neon HTTP driver error shape: check for `err.code === '23505'` (Postgres error code for unique_violation)
- For the `pg` adapter, `err.code` is also `'23505'` — so the same check works for both
- Use `try/catch` around only the insert, not the whole handler
- Keep the existing 201 return path — if no `DATABASE_URL` is configured and `setDbClient` was never called, `c.var.db` is undefined and the insert is skipped entirely (graceful degradation)

---

## Task 5: Local server entry point — `api/src/server.local.ts`

- [x] Completed

**Goal**: Run the Hono app locally with `@hono/node-server` and a `pg` Pool connected to Docker Postgres.

### Files to Create

| File                      | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `api/src/server.local.ts` | Node.js entry that starts the Hono server with local Postgres |

### Implementation

```typescript
import { serve } from '@hono/node-server';
import { Pool } from 'pg';
import app, { setDbClient } from './index';
import { createDbClient } from './db';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

const db = createDbClient('pg', pool);
setDbClient(db);

console.log(`Server running on http://localhost:3000`);
serve({ fetch: app.fetch, port: 3000 });
```

### Verification

```bash
docker compose -f api/docker-compose.yml up -d   # start Postgres
bun run --cwd api dev:local                        # start server
curl -X POST http://localhost:3000/feedback \
  -H 'Content-Type: application/json' \
  -d '{"tripId":"trip-1","message":"Great trail!","idempotencyKey":"test-1","createdAt":"2026-06-03T00:00:00Z"}'
# → 201
```

**Implementation tips**:

- `@hono/node-server`'s `serve` takes `{ fetch: app.fetch, port: 3000 }`
- The `Pool` is created with `max: 5` to avoid overwhelming local Docker
- Clean shutdown: listen for `SIGTERM`/`SIGINT` and call `pool.end()`

---

## Task 6: Wrangler config — `api/wrangler.toml`

- [x] Completed

**Goal**: Prepare the Workers runtime for Neon Postgres access.

### Files to Modify

| File                | Changes                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `api/wrangler.toml` | Update `compatibility_date`, add `nodejs_compat`, add Neon secret reference |

### Changes

```toml
name = "sonora-api"
main = "src/index.ts"
compatibility_date = "2026-06-03"
nodejs_compat = true

# KV binding for feedback idempotency (fast-path only — Postgres is authoritative)
# kv_namespaces = [
#   { binding = "FEEDBACK_STORE", id = "<your-namespace-id>" }
# ]

# Neon Postgres
# Set NEON_DATABASE_URL via: npx wrangler secret put NEON_DATABASE_URL

[vars]
FEEDBACK_MAX_LENGTH = "1000"
DB_ADAPTER = "neon"
```

### Verification

```bash
# After Neon secret is set (deployment step, not needed for dev):
npx wrangler secret put NEON_DATABASE_URL
bun run typecheck  # tsconfig needs @types/node for nodejs_compat (already in devDeps from Task 1)
```

**Implementation tips**:

- `nodejs_compat = true` enables the `node:*` module polyfills that `@neondatabase/serverless` depends on
- The secret is referenced in the Worker env as `env.DATABASE_URL` (the binding name)
- Keep the KV namespace commented out as it's optional for fast-path

---

## Task 7: Makefile targets — database lifecycle + local dev

- [x] Completed

**Goal**: Add `api-db-*` targets to the root Makefile for the database lifecycle.

### Files to Modify

| File       | Changes                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `Makefile` | Add `api-db-up`, `api-db-down`, `api-db-migrate`, `api-db-generate`, `api-db-studio`, `api-dev-local` |

### New Targets (add after the existing `api-*` block)

```makefile
# ── Backend API — Database ──────────────────────

.PHONY: api-db-up
api-db-up: ## Start Postgres (Docker)
	docker compose -f $(API_DIR)/docker-compose.yml up -d

.PHONY: api-db-down
api-db-down: ## Stop Postgres (Docker)
	docker compose -f $(API_DIR)/docker-compose.yml down

.PHONY: api-db-generate
api-db-generate: ## Generate Drizzle migration from schema changes
	cd $(API_DIR) && bun run db:generate

.PHONY: api-db-migrate
api-db-migrate: api-db-generate ## Apply pending Drizzle migrations
	cd $(API_DIR) && bun run db:migrate

.PHONY: api-db-studio
api-db-studio: ## Launch Drizzle Studio (GUI for local DB)
	cd $(API_DIR) && bun run db:studio

.PHONY: api-dev-local
api-dev-local: ## Run Hono API locally with Docker Postgres
	cd $(API_DIR) && bun run dev:local
```

### Verification

```bash
make api-db-up    # should start Postgres container
make api-db-down  # should stop it
make help | grep api-db  # should list all new targets
```

**Implementation tips**:

- Use `$(API_DIR)` variable (already defined in Makefile) for path consistency
- Keep `api-db-migrate` depending on `api-db-generate` (generate then migrate = standard workflow)
- Add a comment block separator like `# ── Backend API — Database ──────────────────────` to match the existing style

---

## Task 8: Generate and verify migration

- [x] Completed

**Goal**: Run Drizzle Kit to produce the initial migration SQL and verify it matches the spec.

### Steps

```bash
# Ensure Docker Postgres is running
make api-db-up

# Generate migration from schema
make api-db-generate
# → Creates api/drizzle/0000_*.sql

# Review the generated SQL
cat api/drizzle/0000_*.sql
```

### Expected SQL

```sql
CREATE SCHEMA IF NOT EXISTS "sonora";
CREATE TABLE IF NOT EXISTS "sonora"."feedback" (
  "id" SERIAL PRIMARY KEY,
  "trip_id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT "feedback_idempotency_key_unique" UNIQUE("idempotency_key")
);
```

### Verification

```bash
# Apply migration
make api-db-migrate

# Verify table exists
docker compose -f api/docker-compose.yml exec -T db psql -U sonora -d sonora -c "\dt sonora.*"
# → Should show feedback table

# Verify column structure
docker compose -f api/docker-compose.yml exec -T db psql -U sonora -d sonora -c "\d sonora.feedback"
# → Should show all columns with correct types and constraints
```

**Implementation tips**:

- Drizzle Kit generates SQL in the `api/drizzle/` directory — commit this to version control
- The schema name `sonora` means the table is `sonora.feedback`, not `public.feedback`
- Add `api/drizzle/` to the API's .gitignore? **No** — migration files should be committed (they are the schema's source of truth for production)
- But `api/.dev.vars` and `api/.wrangler/` should remain gitignored

---

## Task 9: Update tests — mock DB layer + DB-aware duplicate test

- [x] Completed

**Goal**: Add DB layer mocks and test the UNIQUE constraint behavior per the spec scenarios.

### Files to Modify

| File                                 | Changes                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `api/src/__tests__/feedback.test.ts` | Add mock factory, add DB-aware duplicate test, add KV-miss-DB-hit scenario |

### Test Additions

**Mock DB factory** (helper):

```typescript
// Track inserted idempotency keys in-memory, throw 23505 on duplicate
function createMockDb() {
  const store = new Map<string, true>();
  return {
    insert: () => ({
      values: async (values: { idempotencyKey: string }) => {
        if (store.has(values.idempotencyKey)) {
          const err = new Error('duplicate key value violates unique constraint') as any;
          err.code = '23505';
          throw err;
        }
        store.set(values.idempotencyKey, true);
      },
    }),
    _reset: () => store.clear(),
  };
}
```

**New tests** (per spec scenarios):

1. **"Accepted feedback stored"** — POST with unique key → 201, verify mock was called
2. **"Duplicate via UNIQUE constraint"** — POST same key twice → first 201, second 409 (even without KV)
3. **"KV miss, DB hit"** — Simulate KV being empty for a key that exists in mock DB → 409 via DB constraint
4. **"KV hit prevents DB write"** — KV has the key → 409 without attempting DB insert

### Verification

```bash
bun run test  # all 7+ tests pass (existing + new)
bun run typecheck  # no type errors
```

**Implementation tips**:

- Don't need to mock the full Drizzle API — just the `insert().values()` chain with the error shape matching Postgres
- Use `setDbClient(mockDb)` before each test that needs it, and `setDbClient(null)` to clean up
- The "KV hit prevents DB write" test should verify the mock's `insert` was NEVER called (use a spy/counter)
- Keep existing KV-only tests passing by not calling `setDbClient()` in those tests

---

## Delivery Plan

### Order of Execution

```
Task 1: Scaffolding ──────────────────────────────────────► deps, Docker, config
Task 2: Schema ───────────────────────────────────────────► db/schema.ts
Task 3: Factory ──────────────────────────────────────────► db/index.ts
Task 4: Wire handler ─────────────────────────────────────► index.ts (core logic)
Task 5: Local server ─────────────────────────────────────► server.local.ts
Task 6: Wrangler config ──────────────────────────────────► wrangler.toml
Task 7: Makefile ─────────────────────────────────────────► Makefile targets
Task 8: Generate migration ───────────────────────────────► drizzle/ migration SQL
Task 9: Tests ────────────────────────────────────────────► feedback.test.ts
```

Each task builds on the previous one. Tests (Task 9) are last because they depend on the handler being fully wired.

### Rollout Sequence (Post-Implementation)

1. Commit all changes to a `feat/persist-feedback-db` branch
2. Apply migration locally via `make api-db-migrate`
3. Test locally via `make api-dev-local` + curl
4. Deploy to Workers via `make api-deploy`
5. Set `NEON_DATABASE_URL` secret on Workers
6. Run migration against Neon (CI pipeline or manual `drizzle-kit migrate`)
7. Monitor for 409s and 500s in production

### Rollback

- **Code revert**: reset to the previous deploy
- **Schema revert**: execute `DROP SCHEMA IF EXISTS sonora CASCADE;` or roll back migration via Drizzle Kit
