# Proposal: Persist post-trip feedback in Postgres

## Intent

Feedback submission returns 201 without persisting the message — it only stores the idempotency key in KV. Feedback data is lost. This change adds Postgres persistence via Drizzle ORM with dual-environment support (Docker Postgres 17 for local, Neon serverless for Workers).

## Scope

### In Scope

- Drizzle schema + db client factory (pg Pool local, Neon HTTP on Workers)
- DI via Hono `c.set('db', dbClient)` middleware
- `@hono/node-server` local entry point with Docker Postgres 17
- Migration pipeline via `drizzle-kit generate` + `drizzle-kit migrate`
- `docker-compose.yml`, `.dev.vars`, `.gitignore`, updated Makefile & package.json
- Handler refactored to use injected db; KV stays as fast-path idempotency

### Out of Scope

- No client-side or UI changes
- No Hyperdrive setup (deferred)
- No feedback query/read API (deferred)
- No analytics or aggregation

## Capabilities

### New Capabilities

None — persistence is an internal infrastructure change, not a new user-facing capability.

### Modified Capabilities

None — the existing `feedback` spec's API Contract requirement already describes 201/409 correctly. The persistence layer sits beneath the existing contract.

## Approach

1. **Schema** (`api/src/db/schema.ts`): `feedback` pgTable — serial id, trip_id, message, idempotency_key (UNIQUE), created_at (timestamptz).
2. **DB client** (`api/src/db/index.ts`): Factory `createDbClient(adapter, connectionString)` → returns `drizzle(pool)` for pg or `drizzle(neonClient)` for Workers.
3. **DI middleware**: Sets `c.set('db', db)` from factory. Handler reads `c.var.db`.
4. **Handler**: Inserts via Drizzle, catches UNIQUE violation → 409. KV check remains as fast-path optimization.
5. **Local entry** (`api/src/server.local.ts`): Creates Pool, wires middleware, starts `@hono/node-server`.
6. **Config**: `wrangler.toml` → `nodejs_compat` flag + `NEON_DATABASE_URL` secret. `drizzle.config.ts` → schema path. `docker-compose.yml` → Postgres 17.
7. **Testing**: Mock `db/index.ts` for existing tests; optional `RUN_INTEGRATION_TESTS` for Docker-backed DB tests.

## Affected Areas

| Area                                 | Impact   | Description                                        |
| ------------------------------------ | -------- | -------------------------------------------------- |
| `api/src/index.ts`                   | Modified | Handler refactored for DI via `c.set('db', ...)`   |
| `api/wrangler.toml`                  | Modified | `nodejs_compat` flag, updated `compatibility_date` |
| `api/package.json`                   | Modified | 4 deps + 4 dev-deps + new scripts                  |
| `Makefile`                           | Modified | DB targets + split dev modes                       |
| `.env_example`                       | Modified | `DATABASE_URL` placeholder                         |
| `api/src/db/schema.ts`               | **New**  | Drizzle `feedback` table                           |
| `api/src/db/index.ts`                | **New**  | DB client factory                                  |
| `api/src/server.local.ts`            | **New**  | Node.js local entry point                          |
| `api/docker-compose.yml`             | **New**  | Postgres 17 service                                |
| `api/drizzle.config.ts`              | **New**  | Drizzle Kit config                                 |
| `api/.dev.vars`                      | **New**  | Local `DATABASE_URL`                               |
| `api/.gitignore`                     | **New**  | `.dev.vars`, `migrations/`, etc.                   |
| `api/migrations/`                    | **New**  | Generated SQL                                      |
| `api/src/__tests__/feedback.test.ts` | Modified | Mock db layer in tests                             |

## Risks

| Risk                                     | Likelihood | Mitigation                                                   |
| ---------------------------------------- | ---------- | ------------------------------------------------------------ |
| `pg` driver incompatible with Workers    | High       | Use `@neondatabase/serverless` HTTP mode on Workers          |
| Docker unavailable on dev machines       | Medium     | Makefile checks `docker --version`; DB use is optional       |
| `nodejs_compat` breaks existing behavior | Low        | Verify with `wrangler dev` before deploy                     |
| Schema drift between local and Neon      | Low        | Single schema file; same `drizzle-kit generate` SQL for both |

## Rollback Plan

1. Revert `api/src/index.ts` to non-DI handler
2. Revert `wrangler.toml` and `package.json`
3. Remove `api/src/db/`, `api/docker-compose.yml`, `api/drizzle.config.ts`, `api/src/server.local.ts`, `api/.dev.vars`, `api/.gitignore`
4. Revert Makefile and `.env_example`
5. Revert test file changes

## Dependencies

```bash
cd api
bun add drizzle-orm pg @neondatabase/serverless @hono/node-server
bun add -D drizzle-kit @types/node
```

## Success Criteria

- [ ] `POST /feedback` returns 201 and row exists in Postgres
- [ ] Duplicate `idempotency_key` returns 409 (UNIQUE violation)
- [ ] `make api-dev-local` starts Node.js server + Docker Postgres
- [ ] `make api-test` passes with mocked db
- [ ] `drizzle-kit generate` produces correct `CREATE TABLE feedback`
- [ ] Existing client tests pass unchanged
