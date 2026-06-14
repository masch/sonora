# Tasks: Cloud Deployment of API + Database

## Overview

Deploy the Hono API and Neon Postgres database to Cloudflare Workers with staging and production environments. Phase 1 uses Makefile targets for manual deployment — CI/CD is deferred. Two separate Workers (`sonora-api` production, `sonora-api-staging` staging), each with its own Neon project and secrets. No business logic changes.

**Total tasks**: 8 across 5 phases | **Estimated lines**: ~200-250 | **Review risk**: Low (config + infrastructure, no logic changes)

## Required Reading

- `openspec/changes/.../proposal.md` — intent, scope, risks
- `openspec/changes/.../design.md` — architecture decisions, data flow
- `openspec/changes/.../specs/deployment/spec.md` — acceptance scenarios
- `api/wrangler.toml` — current production config
- `api/src/middleware/cors.ts` — current CORS middleware
- `api/src/middleware/db-injector.ts` — how DATABASE_URL is used at runtime
- `api/src/index.ts` — Env interface, middleware mount order
- `api/drizzle.config.ts` — migration config (schema, output dir)
- `api/src/db/index.ts` — DB client factory (neon/pg adapter)
- `api/package.json` — available scripts
- `api/.env` — local env vars (DATABASE_URL, ALLOWED_ORIGIN)
- `.env` — root env vars (EXPO_PUBLIC_API_URL)
- `src/config/app-config.ts` — frontend API URL resolution

---

## Task Breakdown

### Phase 1: Wrangler Config

#### ✅ Task 1.1 — Modify `api/wrangler.toml` (DONE)

**Files**: `api/wrangler.toml`

**Changes**:

1. Fix the comment on line 14: change `NEON_DATABASE_URL` → `DATABASE_URL` to match what the code actually reads (`c.env.DATABASE_URL` in `db-injector.ts`)
2. Add `ENVIRONMENT = "production"` to the `[vars]` block

**Expected**:

```toml
# Neon Postgres
# Set DATABASE_URL via: npx wrangler secret put DATABASE_URL

[vars]
FEEDBACK_MAX_LENGTH = "1000"
DB_ADAPTER = "neon"
ENVIRONMENT = "production"
```

**Acceptance**: Running `npx wrangler deploy --dry-run` succeeds and shows `ENVIRONMENT: production` in the vars.

---

#### ✅ Task 1.2 — Create `api/wrangler.staging.toml` (DONE)

**Files**: `api/wrangler.staging.toml` (new)

**Changes**: Create a staging-specific wrangler config as a near-copy of `wrangler.toml` with:

- `name = "sonora-api-staging"`
- `ENVIRONMENT = "staging"` in `[vars]`

Keep everything else identical (same compatibility_date, compatibility_flags, same comment block for KV namespace and Neon). The KV namespace binding can remain commented out for now.

**Acceptance**:

```toml
name = "sonora-api-staging"
main = "src/index.ts"
compatibility_date = "2026-06-03"
compatibility_flags = [ "nodejs_compat" ]

# KV binding for feedback idempotency (fast-path only — Postgres is authoritative)
# kv_namespaces = [
#   { binding = "FEEDBACK_STORE", id = "<your-namespace-id>" }
# ]

# Neon Postgres
# Set DATABASE_URL via: npx wrangler secret put DATABASE_URL

[vars]
FEEDBACK_MAX_LENGTH = "1000"
DB_ADAPTER = "neon"
ENVIRONMENT = "staging"
```

`npx wrangler deploy --config wrangler.staging.toml --dry-run` succeeds.

---

### Phase 2: CORS Fix

#### ✅ Task 2.1 — Modify `api/src/middleware/cors.ts` (DONE)

**Files**: `api/src/middleware/cors.ts`

**Changes**: Update the `origin` callback in the CORS middleware to handle mobile/native origins:

1. If `Origin` header is `null` (mobile WebView, SFSafariViewController), allow it — return origin as `null`
2. If `Origin` header is missing/undefined (native HTTP clients like React Native `fetch()`), allow it — return origin
3. If a specific `ALLOWED_ORIGIN` is configured and matches, allow it
4. If `ALLOWED_ORIGIN` is not configured, default to allowing any origin (permissive for dev/staging)
5. Otherwise, reject (return undefined)

**Algorithm**:

```ts
origin: (origin) => {
  // Allow mobile WebView (Origin: null) and native HTTP (no origin)
  if (origin === null || origin === undefined) {
    return origin; // returns null for null, undefined for missing
  }
  // If ALLOWED_ORIGIN is not configured, allow all
  if (!allowedOrigin) {
    return origin;
  }
  // Strict check against configured origin
  return origin === allowedOrigin ? origin : undefined;
};
```

**Edge cases**:

- OPTIONS preflight for `Origin: null` must return `Access-Control-Allow-Origin: null`
- Multiple allowed origins is NOT needed yet (keep simple — one `ALLOWED_ORIGIN` env var)
- `ALLOWED_ORIGIN` may contain a trailing slash or wildcard — exact match only for now

**Acceptance**:

- `curl -H "Origin: null" -X OPTIONS ...` returns `Access-Control-Allow-Origin: null`
- `curl -X OPTIONS ...` (no Origin header) returns proper CORS headers
- `curl -H "Origin: https://evil.com" -X OPTIONS ...` does NOT return the origin in ACAO header
- Existing browser flow with `Origin: http://localhost:8081` continues to work

---

#### ✅ Task 2.2 — Add CORS unit tests (DONE)

**Files**: `api/src/__tests__/cors.test.ts` (new)

**Changes**: Create a test file that tests the CORS middleware in isolation using `app.request()` with various origin scenarios:

1. `Origin: null` POST to `/feedback` — returns 2xx with `Access-Control-Allow-Origin: null`
2. No `Origin` header — request passes through middleware
3. `Origin: https://evil.com` — request blocked or CORS headers absent
4. Matching `ALLOWED_ORIGIN` — request passes
5. OPTIONS preflight with `Origin: null` — returns 204 with CORS headers
6. OPTIONS preflight without origin — returns 204 with CORS headers

**Pattern**: Follow the existing `feedback.test.ts` pattern — use `app.request()` with explicit headers. No mock DB needed since CORS runs before route handlers. Tests should validate response headers, not just status codes.

**Acceptance**: `bun test` (or `npx vitest run`) passes with all tests green.

Reference approach from existing tests:

```ts
it('handles Origin: null', async () => {
  const res = await app.request('/feedback', {
    method: 'OPTIONS',
    headers: { Origin: 'null' },
  });
  expect(res.status).toBe(204);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
});
```

---

### Phase 3: Makefile

#### ✅ Task 3.1 — Create `api/Makefile` (DONE)

**Files**: `api/Makefile` (new)

**Changes**: Create a Makefile with the following targets. The Makefile uses environment variables (`DATABASE_URL_STAGING`, `DATABASE_URL_PRODUCTION`) that must be exported before running targets. These are deliberately NOT stored in the Makefile to prevent credential leakage.

**Targets**:

| Target                  | Dependencies            | Action                                                            |
| ----------------------- | ----------------------- | ----------------------------------------------------------------- |
| `db-migrate-staging`    | —                       | `DATABASE_URL=$(DATABASE_URL_STAGING) npx drizzle-kit migrate`    |
| `db-migrate-production` | —                       | `DATABASE_URL=$(DATABASE_URL_PRODUCTION) npx drizzle-kit migrate` |
| `db-seed-staging`       | —                       | `DATABASE_URL=$(DATABASE_URL_STAGING) bun src/db/seed.ts`         |
| `db-seed-production`    | —                       | `DATABASE_URL=$(DATABASE_URL_PRODUCTION) bun src/db/seed.ts`      |
| `deploy-api-staging`    | `db-migrate-staging`    | Deploy Worker, then prompt to set secrets                         |
| `deploy-api-production` | `db-migrate-production` | Deploy Worker, then prompt to set secrets                         |
| `help`                  | —                       | Print available targets                                           |

**Deploy target behavior**: Each deploy target:

1. Runs `db-migrate-<env>` (chained dependency)
2. Deploys the Worker: `npx wrangler deploy --config wrangler.<env>.toml` (for staging — uses `wrangler.staging.toml`; for production — uses default `wrangler.toml`)
3. Prints instructions for setting secrets (`npx wrangler secret put DATABASE_URL --config wrangler.<env>.toml` and similarly for `ALLOWED_ORIGIN`)

**Why manual secrets**: `wrangler secret put` requires interactive input. The Makefile prints the exact commands to run rather than trying to pipe secrets inline (which would leak them into shell history and Makefile output).

**Acceptance**: `make help` lists all targets. `make -n deploy-api-staging` shows the command chain without executing.

---

### Phase 4: Frontend Config

#### ✅ Task 4.1 — Modify root `.env` (DONE)

**Files**: `.env` (root)

**Changes**: Set `EXPO_PUBLIC_API_URL` to the production Worker URL. The actual URL depends on the Cloudflare account's workers.dev subdomain. The value must follow the pattern:

```
EXPO_PUBLIC_API_URL=https://sonora-api.<account-subdomain>.workers.dev
```

**Note**: This value cannot be set until the Worker is deployed and its URL is known. This task is intentionally gated — it should be completed AFTER Phase 5 verifies the production Worker works.

**Acceptance**: After setting the URL and rebuilding the Expo app, `APP_CONFIG.apiBaseUrl` returns the production URL. When the env var is empty or unset, the local fallback (`http://localhost:3000` or `http://10.0.2.2:3000` for Android) continues to work.

---

### Phase 5: Manual Deploy Steps

These tasks cannot be automated — they require Cloudflare and Neon dashboard access. They are documented as procedures to follow after code changes are applied.

#### Task 5.1 — Create Neon Staging Project

**Manual steps**:

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project named `sonora-staging`
3. Copy the connection string (looks like `postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
4. Export it locally: `export DATABASE_URL_STAGING="<connection-string>"`
5. Run the migration: `make db-migrate-staging`
6. Run the seed: `make db-seed-staging`

**Acceptance**: `make db-migrate-staging` exits with status 0 and the `sonora_db_migrations` schema exists in the staging database.

#### Task 5.2 — Deploy Staging Worker

**Manual steps**:

1. Deploy the staging Worker: `make deploy-api-staging`
   - This runs `db-migrate-staging` first (dependency), then `npx wrangler deploy --config wrangler.staging.toml`
2. Set secrets:
   ```bash
   npx wrangler secret put DATABASE_URL --config wrangler.staging.toml
   # Paste the staging Neon connection string
   npx wrangler secret put ALLOWED_ORIGIN --config wrangler.staging.toml
   # Paste the allowed origin (or leave empty to allow all)
   ```
3. Note the Worker URL: `https://sonora-api-staging.<account>.workers.dev`

**Acceptance**: `curl https://sonora-api-staging.<account>.workers.dev/feedback` returns a valid JSON response (not 404 or 500).

#### Task 5.3 — Verify Staging

**Manual verification**:

1. CORS preflight: `curl -H "Origin: null" -H "Access-Control-Request-Method: POST" -X OPTIONS -v https://sonora-api-staging.<account>.workers.dev/feedback` — expect 204 with CORS headers
2. POST feedback: `curl -H "Origin: null" -H "Content-Type: application/json" -d '{"tripId":"test","message":"staging test","idempotencyKey":"verify-1","createdAt":"2026-01-01T00:00:00Z"}' https://sonora-api-staging.<account>.workers.dev/feedback` — expect 201
3. Error case: `curl -H "Origin: https://evil.com" -X OPTIONS -v https://sonora-api-staging.<account>.workers.dev/feedback` — expect NO `Access-Control-Allow-Origin: https://evil.com`

**Acceptance**: All three verification steps pass.

#### Task 5.4 — Deploy Production

**Manual steps** (repeat of 5.1–5.3 for production):

1. Create Neon project `sonora-production` in dashboard
2. Export `DATABASE_URL_PRODUCTION`
3. `make db-migrate-production && make db-seed-production`
4. `make deploy-api-production`
5. Set secrets on production Worker
6. Verify production Worker with curl

**Acceptance**: Production Worker responds correctly at `https://sonora-api.<account>.workers.dev/feedback`.

#### Task 5.5 — Set Frontend API URL

**Manual steps**:

1. After production Worker is verified and its URL is known, update `.env`:
   ```
   EXPO_PUBLIC_API_URL=https://sonora-api.<account>.workers.dev
   ```
2. Rebuild the Expo app (or restart dev server) so the new URL is picked up

**Acceptance**: Frontend makes API requests to the production Worker URL. Running `EXPO_PUBLIC_API_URL="" bun start` reverts to local development URLs.

---

## Verification Summary

| #   | What                    | How                                             | When          |
| --- | ----------------------- | ----------------------------------------------- | ------------- |
| 1   | Wrangler configs valid  | `npx wrangler deploy --dry-run`                 | After Phase 1 |
| 2   | CORS unit tests         | `npx vitest run api/src/__tests__/cors.test.ts` | After Phase 2 |
| 3   | Makefile dry-run        | `make -n deploy-api-staging`                    | After Phase 3 |
| 4   | Staging endpoint        | curl against staging URL                        | After Phase 5 |
| 5   | Production endpoint     | curl against production URL                     | After Phase 5 |
| 6   | Frontend points to prod | Check `APP_CONFIG.apiBaseUrl`                   | After Phase 5 |

## Rollback Instructions

- **Worker**: `npx wrangler delete --config wrangler.staging.toml` (staging) or `npx wrangler delete` (production)
- **Database**: Delete Neon project from dashboard
- **Config files**: `git checkout api/wrangler.toml api/wrangler.staging.toml api/Makefile api/src/middleware/cors.ts .env`
- **Frontend**: `git checkout .env` to restore local-only config
