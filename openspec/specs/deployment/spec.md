# Delta for Deployment

## ADDED Requirements

### Requirement: Environment Isolation

Staging and production MUST use separate Cloudflare Workers and separate Neon Postgres projects. No environment MAY share credentials or config.

| Property     | Production          | Staging              |
| ------------ | ------------------- | -------------------- |
| Worker name  | `sonora-api`        | `sonora-api-staging` |
| Neon project | `sonora-production` | `sonora-staging`     |

#### Scenario: Independent deployment

- GIVEN a Cloudflare account and a Neon project per environment
- WHEN `wrangler deploy` runs for production, `wrangler deploy --config wrangler.staging.toml` for staging
- THEN each Worker points to its own Neon DB via `DATABASE_URL` secret

#### Scenario: Credential isolation

- GIVEN both Workers are deployed
- THEN `DATABASE_URL` and `ALLOWED_ORIGIN` secrets MUST differ between environments

### Requirement: CORS for Mobile

The CORS middleware MUST accept `Origin: null` (mobile WebView) and `undefined` origin (native HTTP) while enforcing `ALLOWED_ORIGIN` for browser requests.

- `origin` callback: return origin if matches `ALLOWED_ORIGIN`, return `null` if origin is null/undefined, return `undefined` otherwise
- MUST handle OPTIONS preflight with correct `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`

#### Scenario: Mobile WebView Origin: null

- GIVEN a mobile client sends POST with `Origin: null`
- WHEN CORS middleware processes
- THEN response includes `Access-Control-Allow-Origin: null` and returns 200

#### Scenario: Native HTTP without Origin

- GIVEN a native client sends POST without `Origin`
- WHEN CORS middleware processes
- THEN the request passes and returns 200

#### Scenario: Browser preflight OPTIONS

- GIVEN a browser sends OPTIONS preflight
- THEN response includes proper CORS headers and status 204

#### Scenario: Disallowed origin

- GIVEN a request with `Origin: https://evil-site.com`
- WHEN CORS middleware processes
- THEN `Access-Control-Allow-Origin` is absent; browser blocks the request

### Requirement: Secret Management

`DATABASE_URL` and `ALLOWED_ORIGIN` MUST be set via `wrangler secret put` on each Worker — never via `[vars]` or source code. Secrets MUST differ per environment.

#### Scenario: Staging secrets set

- GIVEN Worker `sonora-api-staging` exists
- WHEN `wrangler secret put DATABASE_URL` and `wrangler secret put ALLOWED_ORIGIN` run
- THEN `env.DATABASE_URL` and `env.ALLOWED_ORIGIN` are defined at runtime

#### Scenario: Production secrets set

- GIVEN Worker `sonora-api` exists
- WHEN same secrets are set on production
- THEN values MUST differ from staging

### Requirement: Makefile Automation

A Makefile MUST provide targets for deploy, migrate, and seed per environment. Seed targets MUST forward the `SEED_ENV` guard variable to the seed script, and the staging seed target MUST invoke the staging entry.

| Target                      | Action                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| `api-deploy-staging`        | Deploy Worker, set secrets for staging                                      |
| `api-deploy-production`     | Deploy Worker, set secrets for production                                   |
| `api-db-migrate-staging`    | Apply Drizzle migrations to staging Neon                                    |
| `api-db-migrate-production` | Apply Drizzle migrations to production Neon                                 |
| `api-db-seed-ci`            | Seed via base entry using `DATABASE_URL` from env (CI); forwards `SEED_ENV` |
| `api-db-seed-staging`       | Seed staging Neon via `seed-staging.ts` with `SEED_ENV=staging`             |
| `api-db-seed-production`    | Seed production Neon via base entry with `SEED_ENV=production`              |

(Previously: seed targets all invoked the single `seed.ts` with no environment guard.)

#### Scenario: Staging target runs staging entry

- GIVEN `DATABASE_URL_STAGING_CLEAN` configured
- WHEN `make api-db-seed-staging` runs
- THEN `seed-staging.ts` executes with `SEED_ENV=staging`

#### Scenario: Production target runs base entry

- GIVEN `DATABASE_URL_PRODUCTION_CLEAN` configured
- WHEN `make api-db-seed-production` runs
- THEN the base entry executes with `SEED_ENV=production`

### Requirement: Frontend Configuration

`EXPO_PUBLIC_API_URL` in `.env` MUST point to the deployed Worker URL. The existing fallback logic in `src/config/app-config.ts` MUST remain unchanged.

#### Scenario: Production URL configured

- GIVEN `.env` has `EXPO_PUBLIC_API_URL=https://sonora-api.<subdomain>.workers.dev`
- WHEN frontend starts
- THEN `APP_CONFIG.apiBaseUrl` returns the production URL

#### Scenario: Local fallback

- GIVEN `.env` has `EXPO_PUBLIC_API_URL=""` or unset
- WHEN frontend starts
- THEN `APP_CONFIG.apiBaseUrl` returns local dev URL (`http://localhost:3000` or Android emulator variant)

### Requirement: Deploy Trigger Policy

Staging deployment MUST only trigger on `push` to `main` (and `workflow_dispatch`). The system MUST NOT deploy to staging on `pull_request` events. This ensures secrets (DATABASE_URL, CLOUDFLARE_API_TOKEN) are available when migrations, seed, and Worker deploy execute.

#### Scenario: Deploy skipped on PR

- GIVEN a `pull_request` event targeting `main` with changes to `apps/api/**`
- WHEN the CI system evaluates triggers
- THEN the deploy workflow MUST NOT start
- AND the validation workflow runs instead

#### Scenario: Deploy runs on push with secrets

- GIVEN a `push` event to `main` with changes to `apps/api/**`
- WHEN the deploy workflow starts
- THEN the `staging` environment is set
- AND DATABASE_URL is available for `make api-db-migrate-ci`
- AND CLOUDFLARE_API_TOKEN is available for `make api-deploy-staging`

#### Scenario: workflow_dispatch skips path filter

- GIVEN a maintainer triggers `workflow_dispatch` on the deploy workflow
- WHEN the workflow runs
- THEN path filters do NOT apply
- AND all deploy steps execute

### Requirement: Idempotent Staging Steps

Migrations and both seed entries MUST be idempotent. Running `make api-db-migrate-ci` and either seed entry (`seed.ts` or `seed-staging.ts`) on an already-migrated or already-seeded database MUST succeed without side effects.

(Previously: idempotency was required only for `make api-db-seed-ci` / `seed.ts`.)

#### Scenario: Re-running migration is safe

- GIVEN the staging DB already has all migrations applied
- WHEN `make api-db-migrate-ci` runs again
- THEN the command exits 0
- AND no schema changes occur

#### Scenario: Re-running base seed is safe

- GIVEN the staging DB already has base seed data
- WHEN `make api-db-seed-ci` runs again
- THEN the command exits 0
- AND no duplicate records are created

#### Scenario: Re-running staging seed is safe

- GIVEN the staging DB already has staging seed data
- WHEN the staging entry runs again
- THEN the command exits 0
- AND no duplicate `[PRUEBA]` records are created
