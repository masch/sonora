# Design: Cloud Deployment of API + Database

## Technical Approach

Phase 1 — manual deploy via Makefile + wrangler CLI + Neon dashboard. Two separate Cloudflare Workers (`sonora-api` prod, `sonora-api-staging` staging) each with their own `DATABASE_URL` secret pointing to separate Neon Postgres projects. No CI/CD — deferred to Phase 2.

**Wrangler config strategy**: Two config files approach — `wrangler.toml` for production (no suffix), `wrangler.staging.toml` for staging. The alternative (single config with `--env` flag) was rejected because the decision was to use separate Workers, not wrangler environments. Two configs keep each file minimal and explicit — only `name`, secrets, and vars differ.

**Neon project strategy**: Two separate projects (`sonora-production`, `sonora-staging`). The free tier allows this. No Neon Auth — connection string with user/password is sufficient for Phase 1. Staging starts empty; seed is run manually via Makefile after migration.

**CORS strategy**: The existing middleware uses `hono/cors` with an origin callback. It must now accept `Origin: null` (mobile WebView/SFSafariViewController) and treat missing `Origin` header as allowed (native HTTP clients like `fetch` from React Native), while still respecting `ALLOWED_ORIGIN` for browser-based requests.

## Architecture Decisions

| Decision              | Choice                                                | Rationale                                                             |
| --------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Worker separation     | Separate Workers (not env in one config)              | Clear URL distinction, independent deployments                        |
| Config approach       | Two files (`wrangler.toml` + `wrangler.staging.toml`) | Explicit, minimal diff between envs, no env flag confusion            |
| Secret mechanism      | `wrangler secret put` for each Worker                 | Standard Workers practice, no hardcoded secrets                       |
| Secret naming         | `DATABASE_URL` (not `NEON_DATABASE_URL`)              | Code already reads `c.env.DATABASE_URL`; fix comment only             |
| CORS for mobile       | Allow `Origin: null` and missing origin               | `Origin: null` sent by WebViews; `undefined` sent by native `fetch()` |
| DB adapter            | `@neondatabase/serverless` HTTP mode                  | Works in Workers runtime, fast cold starts, no pooling needed         |
| Environment detection | `ENVIRONMENT` var set per Worker                      | Allows code to adapt behavior per env if needed                       |
| No Hyperdrive         | Deferred — acceptable for MVP                         | Workers + Neon HTTP mode is sufficient for low traffic                |

## Data Flow

```
Expo app (mobile/web) → fetch(`${EXPO_PUBLIC_API_URL}/feedback`)
  → Cloudflare Edge → sonora-api.{account}.workers.dev (or staging variant)
    → Hono `configureCors()` middleware (accepts Origin: null)
    → Hono `injectDb()` middleware (reads `c.env.DATABASE_URL`)
    → Hono feedback route handler
    → drizzle ORM → `@neondatabase/serverless` neon() → Neon Postgres
```

The `db-injector.ts` creates a singleton `DbClient` on first request using `c.env.DATABASE_URL` and `c.env.DB_ADAPTER`. Subsequent requests reuse the cached client. In local dev, the flow remains unchanged — `server.local.ts` starts its own `pg.Pool` and injects via `setDbClient()`.

## File Changes

| File                         | Action | Details                                                                                                                                                               |
| ---------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/wrangler.toml`          | Modify | Fix `NEON_DATABASE_URL` comment → `DATABASE_URL`. Add `ENVIRONMENT = "production"` to `[vars]`                                                                        |
| `api/wrangler.staging.toml`  | Create | Same as production but `name = "sonora-api-staging"`, `ENVIRONMENT = "staging"`                                                                                       |
| `api/Makefile`               | Create | `deploy-api-staging`, `deploy-api-production`, `db-migrate-staging`, `db-migrate-production`, `db-seed-staging`, `db-seed-production`. Migrate-before-deploy chaining |
| `api/src/middleware/cors.ts` | Modify | Accept `Origin: null`, missing origin, AND configured `ALLOWED_ORIGIN`. Env var `CORS_ALLOW_ALL` to bypass origin check entirely for staging                          |
| `.env`                       | Modify | Set `EXPO_PUBLIC_API_URL` to production Worker URL                                                                                                                    |

No changes needed: `src/config/app-config.ts` already reads `EXPO_PUBLIC_API_URL`. `api/src/db/index.ts`, `api/src/db/schema.ts`, `api/drizzle.config.ts` all work as-is.

## Migration Strategy

No migration needed for existing data — there is no production database yet. Fresh Neon projects start empty. The existing Drizzle migration (`api/migrations/0000_curved_ikaris.sql`) is applied to each Neon project during setup via `npx drizzle-kit migrate`. The migration uses schema `sonora_db_migrations` as configured in `drizzle.config.ts`.

## Testing Strategy

| Layer  | What                  | How                                                                                            |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| Unit   | CORS middleware       | Existing Vitest tests + new tests for `Origin: null`, missing origin, multiple allowed origins |
| Unit   | Makefile targets      | Not tested (shell scripts) — validate by running `make -n` (dry-run)                           |
| Manual | Staging deploy        | `make deploy-api-staging` → curl `https://sonora-api-staging.{account}.workers.dev/feedback`   |
| Manual | CORS validation       | `curl -H "Origin: null" -X OPTIONS ...` returns `Access-Control-Allow-Origin: null`            |
| Manual | Frontend connectivity | Run Expo app pointing to staging URL, submit feedback                                          |
| Manual | Production deploy     | Repeat staging flow with `make deploy-api-production`                                          |

## Rollback Plan

- **Worker**: `wrangler delete` the specific Worker (staging or production)
- **Database**: Delete Neon project from dashboard
- **Frontend**: Restore `.env` from git — `EXPO_PUBLIC_API_URL=""` falls back to localhost
- **Config files**: `git checkout` to revert changes
