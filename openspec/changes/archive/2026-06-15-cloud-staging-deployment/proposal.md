# Proposal: Cloud Deployment of API + Database

## Intent

Deploy the existing Hono API and Neon Postgres database to the cloud with staging and production environments, using Makefile targets for manual deployment. The frontend remains local but points to the deployed API. CI/CD is deferred.

## Scope (In)

- **Makefile** (`api/Makefile`): targets for `deploy-api-staging`, `deploy-api-production`, `db-migrate-staging`, `db-migrate-production`, `db-seed-staging`, `db-seed-production`
- **Wrangler config**: two separate Workers (not env-based) — `sonora-api` (production) and `sonora-api-staging`
- **Neon**: two separate projects — `sonora-production` and `sonora-staging` (staging starts empty, seeded manually)
- **Secrets**: `DATABASE_URL` + `ALLOWED_ORIGIN` per Worker via `wrangler secret put`
- **CORS**: update middleware to handle mobile `Origin: null` and make `ALLOWED_ORIGIN` configurable via env var
- **Frontend config**: update `.env` with `EXPO_PUBLIC_API_URL` pointing to deployed Worker URL
- **Fix wrangler.toml comment**: correct misleading `NEON_DATABASE_URL` reference to `DATABASE_URL`

## Scope (Out)

- CI/CD pipeline for API — deferred to follow-up
- Custom domain — workers.dev subdomain is sufficient for now
- Neon Auth — plain connection string is enough
- KV namespace for feedback idempotency — optional, not in scope
- Hyperdrive for db connection pooling — acceptable for MVP without it

## Capabilities

This is an infrastructure and configuration change. No new API capabilities are added.

- **New capabilities**: None
- **Modified capabilities**: None

## Approach

### Phase 1 — Makefile + Manual Deploy

1. **Wrangler config**: set up two configs — `wrangler.toml` for production (`name = "sonora-api"`) and `wrangler.staging.toml` for staging (`name = "sonora-api-staging"`). Both share the same code but point to different Neon databases via secrets.
2. **CORS middleware update**: relax origin matching to allow `Origin: null` (mobile WebView) and `undefined` origin (native HTTP clients), while still respecting `ALLOWED_ORIGIN` for browser requests.
3. **Makefile** (`api/Makefile`): add targets that run `wrangler deploy --config <file>`, `drizzle-kit migrate`, and `drizzle-kit seed` against the appropriate environment.
4. **Neon staging**: create project via Neon dashboard, copy connection string.
5. **Deploy staging**: `make deploy-api-staging` — runs migration, deploys Worker, sets `DATABASE_URL` and `ALLOWED_ORIGIN` secrets.
6. **Verify staging**: test `POST /feedback` against `sonora-api-staging.<account>.workers.dev`.
7. **Neon production**: create separate project, repeat deploy + migrate + seed.
8. **Frontend**: set `EXPO_PUBLIC_API_URL` in `.env` pointing to production Worker. Rebuild to pick up the value.

### Phase 2 — CI/CD (follow-up, out of scope)

Add `api/**` to a GitHub Actions workflow or create a separate one for automatic deploy on push to `main`.

## Affected Areas

| Area                         | Change                                                 |
| ---------------------------- | ------------------------------------------------------ |
| `api/wrangler.toml`          | Modified — fix `NEON_DATABASE_URL` comment             |
| `api/wrangler.staging.toml`  | New — staging Worker config                            |
| `api/Makefile`               | New — deploy, migrate, seed targets                    |
| `api/src/middleware/cors.ts` | Modified — handle `Origin: null` / `undefined`         |
| `.env`                       | Modified — set `EXPO_PUBLIC_API_URL`                   |
| `src/config/app-config.ts`   | No change needed — already reads `EXPO_PUBLIC_API_URL` |

## Risks

| Risk                                                                                 | Severity | Mitigation                                                       |
| ------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------- |
| CORS blocks mobile requests                                                          | Medium   | Relax origin matching; test with WebView / native HTTP           |
| Secret naming mismatch (comment says `NEON_DATABASE_URL`, code reads `DATABASE_URL`) | Low      | Fix comment; use correct name when setting secrets               |
| Migration forgotten before deploy                                                    | Medium   | Makefile target chains migrate before deploy                     |
| Scale-to-zero cold start                                                             | Low      | Acceptable for MVP; `@neondatabase/serverless` HTTP mode is fast |
| Two configs drift apart                                                              | Low      | Keep them minimal; only `name` differs                           |

## Rollback

- **Worker**: `wrangler delete` the Worker (both staging and production as needed)
- **Database**: delete the Neon project from dashboard (or use CLI)
- **Frontend**: restore `.env` from git checkout
- **Makefile/wrangler config**: revert and delete the new files

## Dependencies

- Cloudflare account (free tier) — already used by the project
- Neon account (free tier) — new, sign up at neon.tech

## Success Criteria

- [ ] `make deploy-api-staging` deploys the Worker and it responds to requests
- [ ] `make db-migrate-staging` applies migrations to the staging Neon database
- [ ] Staging API is accessible at `sonora-api-staging.<account>.workers.dev`
- [ ] Frontend with `EXPO_PUBLIC_API_URL=staging-url` submits feedback successfully
- [ ] Same flow works for production at `sonora-api.<account>.workers.dev`
- [ ] Mobile `Origin: null` requests do not get CORS errors
