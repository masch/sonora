# Exploration: Deploy API + Database to Cloud

## Current State

### Database (Postgres via Docker, local only)

- **Schema**: `sonora` schema with `trips` + `feedback` tables in `api/src/db/schema.ts`
- **Migrations**: Single migration `0000_curved_ikaris.sql` via Drizzle Kit
- **Seed data**: `api/src/db/seed.ts` — 2 default trips with upsert
- **Local setup**: Docker Compose (`api/docker-compose.yml`) with Postgres 17 Alpine
- **Production driver**: `@neondatabase/serverless` already installed and configured in `api/src/db/index.ts` via `createDbClient('neon', connectionString)`
- **Local driver**: `pg` (node-postgres Pool) via `createDbClient('pg', pool)`

### API (Hono + Cloudflare Workers, local dev only)

- **Entry point** (`api/src/index.ts`): Exports default Hono app — ready for Wrangler deploy
- **Wrangler config** (`api/wrangler.toml`): `name = "sonora-api"`, `compatibility_date = "2026-06-03"`, `nodejs_compat` flag, `DB_ADAPTER = "neon"` var
- **DB injection** (`api/src/middleware/db-injector.ts`): Module-level singleton `_dbClient`, initialized from `c.env.DATABASE_URL` when running in Worker mode
- **CORS** (`api/src/middleware/cors.ts`): Configurable via `ALLOWED_ORIGIN`, `ALLOWED_METHODS`, `ALLOWED_HEADERS` env vars
- **Secrets** (`api/.dev.vars`): Local `DATABASE_URL` + `ALLOWED_ORIGIN=http://localhost:8081`
- **Routes**: Singular `POST /feedback` route in `api/src/routes/feedback.ts`
- **KV optional**: `FEEDBACK_STORE` namespace for idempotency fast-path (commented out in wrangler.toml)

### Frontend (Expo SDK 56, currently local)

- **API URL config** (`src/config/app-config.ts`): Reads `EXPO_PUBLIC_API_URL` env var, falls back to `http://localhost:3000` (or `http://10.0.2.2:3000` for Android emulator)
- **Current `.env`**: `EXPO_PUBLIC_API_URL=""` (empty — uses fallback)
- **API consumers**: `src/hooks/use-feedback-sync.ts` and `src/components/trip-detail-view.tsx` — both POST to `{apiBaseUrl}/feedback`
- **Offline queue**: Feedback is queued via `expo-sqlite/kv-store` when network unavailable, flushed on reconnect

### CI/CD (GitHub Actions)

- `.github/workflows/deploy.yml` exists but explicitly ignores `api/**` changes (line 8: `paths-ignore: ['api/**']`)
- Deploys only the Expo frontend (EAS Hosting + Android APK + Firebase Distribution)
- No API or database deployment pipeline exists

### Secret Naming Mismatch

- `api/wrangler.toml` comment says: `Set NEON_DATABASE_URL via: npx wrangler secret put NEON_DATABASE_URL`
- Actual code in `api/src/middleware/db-injector.ts` reads: `c.env?.DATABASE_URL`
- **The secret must be named `DATABASE_URL`**, not `NEON_DATABASE_URL`

## Affected Areas

| Area                | Impact          | Details                                                              |
| ------------------- | --------------- | -------------------------------------------------------------------- |
| **Database** (Neon) | New service     | Create Neon project, run migration + seed                            |
| **API** (Workers)   | Deploy          | Wrangler deploy with secrets: `DATABASE_URL`, `ALLOWED_ORIGIN`       |
| **Frontend Config** | Update          | Set `EXPO_PUBLIC_API_URL` to Worker URL in `.env`                    |
| **CORS Config**     | Update          | Set `ALLOWED_ORIGIN` to match deployed frontend origin               |
| **CI/CD**           | Optional update | Consider adding API deploy to workflow or creating separate workflow |
| **Secrets**         | Fix mismatch    | Use `DATABASE_URL` secret name (not `NEON_DATABASE_URL`)             |

## Approaches

### Option A: Minimal (Database + API only)

1. Create Neon project and database
2. Run `DATABASE_URL=<neon-url> bun run db:migrate` locally to apply migrations
3. Run `DATABASE_URL=<neon-url> bun run db:seed` to seed data
4. Deploy Worker: `cd api && wrangler deploy`
5. Set secrets: `wrangler secret put DATABASE_URL`, `wrangler secret put ALLOWED_ORIGIN`
6. Update frontend `.env` with `EXPO_PUBLIC_API_URL=https://sonora-api.<your-subdomain>.workers.dev`
7. Test locally by rebuilding Expo

**Pros**: Fast, manual, zero infrastructure changes  
**Cons**: No automation, manual steps prone to error, no CI/CD for API

### Option B: Basic CI/CD (Database + API + automated deploy)

Option A + create a new GitHub Actions workflow for API deploys:

- Trigger: push to `main` with changes in `api/**`
- Steps: `wrangler deploy` with environment-specific secrets
- Database migration step (consider safety — only run on deploy, not every push)

**Pros**: Automated, reproducible, CI gated  
**Cons**: More setup, need to handle migration safety (don't re-run on every deploy)

### Option C: Full (includes frontend deployment config updates)

Option B + update the existing `deploy.yml` to no longer ignore `api/**` and include API deploys in the same workflow, or better, create a separate api-deploy workflow for cleaner separation of concerns.

**Pros**: Unified deployment, single source of truth  
**Cons**: Couples frontend and backend deploys; the existing workflow is already complex

## Recommendation

**Option A as immediate next step**, with Option B as a follow-up.

The API is already structured for Workers deployment. The main practical steps are:

1. **Create Neon project** (via Neon dashboard or CLI)
2. **Run migration + seed** against Neon using the existing Drizzle Kit commands
3. **Deploy Worker** with `wrangler deploy`, set `DATABASE_URL` and `ALLOWED_ORIGIN` as secrets
4. **Update `.env`** with the Worker URL

After this is working, create a GitHub Actions workflow for API deploys in a second pass.

### Additional Considerations

#### CORS for Mobile Apps

Mobile apps (iOS/Android) typically send requests with no `Origin` header or `Origin: null`. The current CORS middleware's `origin` callback checks `origin === allowedOrigin` — for mobile apps where origin is `undefined`, this returns `undefined` (no CORS header). This works for simple requests but preflight `OPTIONS` requests might fail. Consider relaxing to `origin: '*'` or allowing `origin === undefined` for mobile clients.

#### Smart Placement

The Workers best-practices skill recommends using **Hyperdrive** for external Postgres connections. Smart Placement should be considered to place the Worker closer to the Neon database (not closer to users). However, with `@neondatabase/serverless` HTTP mode, latency is already low since each query is an independent HTTP request. Smart Placement can be added later as an optimization.

#### KV Idempotency Store

The `FEEDBACK_STORE` KV namespace is optional but provides a fast-path idempotency check before hitting the database. For production, consider creating the KV namespace and updating `wrangler.toml` with the binding.

#### Secret Names

Use `DATABASE_URL` (not `NEON_DATABASE_URL`) — this is what the actual code reads. The comment in `wrangler.toml` is misleading and should be updated.

#### Worker URL Subdomain

After first `wrangler deploy`, the Worker will be available at `https://sonora-api.<your-subdomain>.workers.dev`. The subdomain is set during `wrangler login` / Cloudflare account setup. Alternatively, a custom domain can be configured.

## Risks

| Risk                                                                                     | Impact                                     | Mitigation                                                            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `DATABASE_URL` vs `NEON_DATABASE_URL` naming mismatch                                    | Secret won't be found by db-injector       | Use `DATABASE_URL` when setting secrets; update wrangler.toml comment |
| CORS blocks mobile app requests                                                          | Feedback submission fails from iOS/Android | Test with mobile origin; consider `origin: '*'` for mobile            |
| Migration requires local Drizzle Kit run                                                 | Manual step, easy to forget                | Document clearly; automate in later CI pass                           |
| Seed data needs to be re-run if DB is recreated                                          | Data loss on DB reset                      | Include seed in deployment docs                                       |
| Worker cold start with Neon HTTP driver                                                  | First request may be slow                  | Neon HTTP is already optimized; acceptable for API usage              |
| `nodejs_compat` flag may have compatibility issues with newer `@neondatabase/serverless` | Runtime errors                             | Test locally with `wrangler dev` before deploy                        |
| No Hyperdrive configured for Neon                                                        | Higher latency on each query               | Acceptable for MVP; add Hyperdrive later as performance optimization  |

## Ready for Proposal

Yes
