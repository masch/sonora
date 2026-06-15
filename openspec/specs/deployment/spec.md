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

A Makefile at `api/Makefile` MUST provide targets for deploy, migrate, and seed per environment.

| Target                  | Action                                      |
| ----------------------- | ------------------------------------------- |
| `deploy-api-staging`    | Deploy Worker, set secrets for staging      |
| `deploy-api-production` | Deploy Worker, set secrets for production   |
| `db-migrate-staging`    | Apply Drizzle migrations to staging Neon    |
| `db-migrate-production` | Apply Drizzle migrations to production Neon |
| `db-seed-staging`       | Seed staging Neon database                  |
| `db-seed-production`    | Seed production Neon database               |

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
