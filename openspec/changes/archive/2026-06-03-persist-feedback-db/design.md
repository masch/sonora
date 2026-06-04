# Design: Persist Feedback in Postgres

## Technical Approach

Add a Drizzle ORM persistence layer behind the existing `POST /feedback` handler. A dual-environment factory (`pg` Pool locally, `@neondatabase/serverless` HTTP on Workers) injected via Hono `c.set('db', db)` middleware. KV stays as fast-path idempotency optimization; the Postgres `idempotency_key` UNIQUE constraint is the authoritative dedup.

## Architecture Decisions

### Decision: Dependency Injection via c.set

| Option                          | Tradeoff                                                               | Decision |
| ------------------------------- | ---------------------------------------------------------------------- | -------- |
| A: Factory `createApp(db)`      | Changes export shape, more refactoring                                 | ❌       |
| B: `c.set('db', db)` middleware | Works inline, extends `Env` types, minimal changes to existing handler | ✅       |
| C: Module singleton             | Global state, not testable on Workers                                  | ❌       |

**Rationale**: `c.set`/`c.var` is the idiomatic Hono pattern for request-scoped DI. The handler already reads `c.env` — adding `c.var.db` is a natural extension. Type-safe via `Variables` generic.

### Decision: Explicit Factory createDbClient(adapter, connectionString)

| Option                | Tradeoff                                                   | Decision |
| --------------------- | ---------------------------------------------------------- | -------- |
| A: env-var switch     | Doesn't work on Workers (no `process.env`)                 | ❌       |
| B: Explicit factory   | Called from entry point, clear adapter selection, testable | ✅       |
| C: Middleware-per-env | Duplicates wiring logic                                    | ❌       |

**Rationale**: The factory is called once at startup in each entry point (`server.local.ts` passes `'pg'`, Workers reads `DB_ADAPTER` from env and calls with `'neon'`). The returned `DbClient` interface is identical — Drizzle's query builder abstracts the driver.

### Decision: KV as Fast-Path Only

KV idempotency check stays as an optimization. The UNIQUE constraint on `sonora.feedback.idempotency_key` is the source of truth. This means even if KV is empty/stale, a duplicate insert hits the constraint and returns 409.

### Decision: No Hyperdrive for MVP

Hyperdrive provides connection pooling for Postgres on Workers but requires a paid plan. Start with `@neondatabase/serverless` HTTP mode (no persistent connection needed). Add Hyperdrive as a performance optimization later.

## Data Flow

```
Client ──POST /feedback──► Handler
                              │
                    ┌─────────▼─────────┐
                    │  1. Validate body  │
                    │  2. KV fast-check  │──existing?──► 409
                    │  3. DB insert      │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Drizzle ORM       │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         pg Pool        neon HTTP        (mock)
      (Node.js)        (Workers)        (tests)

Error paths: 422 (validation), 409 (duplicate via KV or UNIQUE),
500 (DB connection failure, unhandled errors)
```

## File Changes

| File                                 | Action | Description                                                                           |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------- |
| `api/src/db/schema.ts`               | Create | Drizzle pgSchema `sonora.feedback` table definition                                   |
| `api/src/db/index.ts`                | Create | `createDbClient(adapter, connectionString)` factory                                   |
| `api/src/server.local.ts`            | Create | `@hono/node-server` entry with `pg` Pool                                              |
| `api/docker-compose.yml`             | Create | Postgres 17 service (port 5432)                                                       |
| `api/drizzle.config.ts`              | Create | Drizzle Kit config (`./src/db/schema.ts` → `./migrations`)                            |
| `api/.dev.vars`                      | Create | `DATABASE_URL=postgres://sonora:sonora@localhost:5432/sonora`                         |
| `api/.gitignore`                     | Create | Ignore `.dev.vars`, `migrations/`, `.wrangler/`                                       |
| `api/src/index.ts`                   | Modify | Add `DbClient` to `Variables`, inject middleware, refactor handler to use `c.var.db`  |
| `api/wrangler.toml`                  | Modify | `nodejs_compat` flag, update `compatibility_date`, `NEON_DATABASE_URL` secret binding |
| `api/package.json`                   | Modify | Add 4 deps + 4 dev-deps + new scripts                                                 |
| `Makefile`                           | Modify | Add `api-db-*` targets, split `api-dev-local` mode                                    |
| `.env_example`                       | Modify | Add `DATABASE_URL` placeholder                                                        |
| `api/src/__tests__/feedback.test.ts` | Modify | Mock db layer, add DB-aware duplicate test                                            |

## Interfaces / Contracts

```ts
// api/src/db/schema.ts
import { pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const sonoraSchema = pgSchema('sonora');

export const feedback = sonoraSchema.table('feedback', {
  id: serial('id').primaryKey(),
  tripId: text('trip_id').notNull(),
  message: text('message').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// api/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres'; // local
// import { neon } from '@neondatabase/serverless';      // Workers
// import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http'; // Workers

export function createDbClient(connectionString: string, adapter: 'pg' | 'neon') {
  if (adapter === 'pg') {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString });
    return drizzle(pool, { schema: { feedback } });
  }
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-http');
  return neonDrizzle(neon(connectionString), { schema: { feedback } });
}
```

## Testing Strategy

| Layer       | What                                   | Approach                                                                                                                     |
| ----------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Handler behavior with injected mock db | Vitest mock `db/index.ts` — mock the return of `createDbClient` to return a db with mocked `insert().values().returning()`   |
| Unit        | KV idempotency still works             | Existing tests with mock `FEEDBACK_STORE` remain passing                                                                     |
| Integration | Real SQL against Postgres              | Optional `api/src/__tests__/feedback.db.integration.test.ts`, gated by `RUN_INTEGRATION_TESTS` env var, uses Docker Postgres |
| Migration   | `drizzle-kit generate` output          | Verify generated SQL matches schema spec                                                                                     |

## Migration / Rollout

1. **Install deps**: `bun add drizzle-orm pg @neondatabase/serverless @hono/node-server && bun add -D drizzle-kit @types/node`
2. **Generate migration**: `bunx drizzle-kit generate` (from `api/`)
3. **Apply locally**: `bunx drizzle-kit migrate` (with Docker Postgres running)
4. **Deploy**: Wrangler deploy — the Neon database is created via Neon dashboard/API; `wrangler secret put NEON_DATABASE_URL`
5. **Run migration on Neon**: `DATABASE_URL=$NEON_DATABASE_URL bunx drizzle-kit migrate` (CI pipeline)
6. **Rollback**: Revert code, drop `sonora.feedback` table via migration

## Open Questions

- [ ] Should `sql` template from drizzle-orm be used for the `pgSchema` + `CREATE SCHEMA IF NOT EXISTS` in migration, or does `drizzle-kit generate` handle it? (Depends on Drizzle Kit pgSchema support — verify before coding.)
- [ ] Does `@neondatabase/serverless` HTTP mode work without `nodejs_compat`? (The exploration says yes for HTTP mode, but verify against actual Workers runtime.)
