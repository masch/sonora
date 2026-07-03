# Sonora

Universal Expo app targeting iOS, Android, and Web.

**Stack:** Expo SDK 56 · React Native 0.85 · TypeScript 6.0 · expo-router · Tailwind CSS v4 · Jest

## Environments (Web Access)

- **Production:** [https://sonoraderivapoeticas-team-sonora.expo.app/](https://sonoraderivapoeticas-team-sonora.expo.app/) (main web application)
- **Staging:** [https://sonoraderivapoeticas-team-sonora--staging.expo.app/](https://sonoraderivapoeticas-team-sonora--staging.expo.app/) (pull request preview builds)

## Prerequisites

- [bun](https://bun.sh) — package manager
- `make` — build tool (comes with macOS/Linux)
- [gga](https://github.com/enzonotario/gga) (optional) — AI code review

```bash
# Install gga (if not installed)
bun install -g gga
```

## Setup

```bash
make install
```

This runs `bun install` and configures the git pre-commit hook.

> **Note:** Always use `make install` for setup. Running `bun install` directly will not configure the git hook.

## Development

```bash
make          # or make start — Expo dev server (platform picker)
make dev-web  # Expo dev server for web
make dev-ios  # Expo dev server for iOS
make dev-android # Expo dev server for Android
```

## Makefile targets

| Target                                | Description                                                   |
| ------------------------------------- | ------------------------------------------------------------- |
| `start`                               | Launch Expo dev server (default)                              |
| `dev-web` / `dev-ios` / `dev-android` | Launch Expo dev server for a specific platform                |
| `install`                             | Install dependencies + configure git hook                     |
| `format`                              | Format code with Prettier                                     |
| `test-front`                          | Run frontend tests (Jest)                                     |
| `api-test` / `test-back`              | Run backend API tests (Vitest)                                |
| `test`                                | Run all tests (frontend + backend)                            |
| `lint`                                | Run ESLint via `expo lint`                                    |
| `typecheck`                           | TypeScript type checking (`tsc --noEmit`)                     |
| `validate`                            | Full development gate: format → test → lint → typecheck → gga |
| `check`                               | CI verification gate: format-check → test → lint → typecheck  |
| `gga`                                 | Run GGA code review on staged files                           |
| `gga-full`                            | Run GGA on all source files (stages, reviews, unstages)       |
| `doctor`                              | Run `expo-doctor` diagnostics                                 |
| `clean`                               | Remove build artifacts and `node_modules`                     |
| `reset`                               | Full reset: `clean` + `install`                               |
| `help`                                | Print all targets                                             |

### Validation pipeline

The `validate` target runs on every commit via a **git pre-commit hook** (`.githooks/pre-commit`). It runs:

1. **format** — Prettier formats all files
2. _Staged automatically_ — formatted files are added to the commit
3. **test** — Jest suite
4. **lint** — ESLint
5. **typecheck** — TypeScript compiler check
6. **gga** — AI code review on staged files

If any step fails, the commit is blocked.

## Project structure

```
src/
├── app/          # expo-router file-based routes
├── components/   # Reusable UI components
├── constants/    # App constants
├── hooks/        # Custom React hooks
├── i18n/         # Internationalization
├── tw/           # Tailwind utilities
├── __tests__/    # Test suites
├── __mocks__/    # Test mocks
└── global.css    # Global styles
```

## API — Feedback Database

The backend API (`api/`) stores feedback in Postgres. Two runtimes are supported: local development with Podman, and production on Cloudflare Workers with Neon.

### Local setup

```bash
# 1. Start Postgres via Podman
make api-db-up

# 2. Generate and apply the initial migration
make api-db-migrate

# 3. Start the local Hono server (port 3000)
make api-dev-local

# 4. Test it
curl -X POST http://localhost:3000/feedback \
  -H 'Content-Type: application/json' \
  -d '{"tripId":"trip-1","message":"Great trail!","idempotencyKey":"key-1","createdAt":"2026-06-03T00:00:00.000Z"}'

# 5. Open a psql shell to inspect data
make api-db-shell

# 6. Stop Postgres when done
make api-db-down
```

### Production setup (Neon + Cloudflare Workers)

```bash
# 1. Create a Neon Postgres project (https://neon.tech)
#    Copy the connection string (starts with postgres://...)

# 2. Generate and apply the migration locally first
make api-db-migrate

# 3. Set the Neon connection string as a Worker secret
cd api && npx wrangler secret put NEON_DATABASE_URL
# Paste the connection string when prompted

# 4. Deploy the API to Cloudflare Workers
make api-deploy
```

The Worker reads `DB_ADAPTER=neon` from `wrangler.toml` and connects via `@neondatabase/serverless` HTTP driver automatically.

### Makefile targets (database)

| Target            | Description                                  |
| ----------------- | -------------------------------------------- |
| `api-db-up`       | Start Postgres container (Podman)            |
| `api-db-down`     | Stop Postgres container                      |
| `api-db-generate` | Generate a Drizzle migration from schema     |
| `api-db-migrate`  | Generate + apply pending migrations          |
| `api-db-studio`   | Launch Drizzle Studio (GUI database browser) |
| `api-db-shell`    | Open an interactive psql shell               |
| `api-dev-local`   | Run the API server locally with Postgres     |

## App Version Check

The app enforces a minimum version via remote config. On `init()`, the store fetches config from the API, compares the installed version (from `app.config.ts` → `Constants.expoConfig.version`) against the server's `minimumVersion`, and sets a `versionStatus` that drives conditional UI.

### States

| Status  | UI                                                           | Condition                                                                    |
| ------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `ok`    | Normal app                                                   | Installed version >= minimum version                                         |
| `warn`  | `UpdateWarningBanner` (non-blocking, dismissible)            | Installed version < minimum, `blockOlderVersions=false`                      |
| `block` | `UpdateRequiredModal` (blocking — full-screen, no dismissal) | Installed version < minimum, `blockOlderVersions=true` (and no active grace) |

### Grace period

When `blockOlderVersions=true`, a grace period can downgrade `block` → `warn` for a window defined by the server:

```text
now >= GRACE_PERIOD_START && now < GRACE_PERIOD_END  →  warn (downgraded)
otherwise                                               block
```

- Grace period is **server-authoritative** — dates are ISO 8601 strings compared server-side, and the result is included in the API response. Client does not compute grace.
- If `GRACE_PERIOD_START` or `GRACE_PERIOD_END` is missing, no grace is applied.

### API environment variables

Set these on the Cloudflare Worker (`[vars]` in `wrangler.toml` or `wrangler.secret.toml`, or `wrangler secret put`):

| Variable               | Default  | Description                                                      |
| ---------------------- | -------- | ---------------------------------------------------------------- |
| `MINIMUM_APP_VERSION`  | `0.0.0`  | Semver minimum required version. Set to `0.0.0` to disable check |
| `BLOCK_OLDER_VERSIONS` | `false`  | When `true`, below-minimum users see a blocking modal            |
| `GRACE_PERIOD_START`   | _(none)_ | ISO date start of grace window (e.g. `2026-06-25`)               |
| `GRACE_PERIOD_END`     | _(none)_ | ISO date end of grace window (e.g. `2026-07-10`)                 |

> **Note:** `MINIMUM_APP_VERSION=0.0.0` in dev bypasses the version check. In staging/production set it to the actual minimum.

### Manual testing

The app version is `1.0.0` (hardcoded in `app.config.ts`). To test each state, deploy the API with different `[vars]` in `wrangler.staging.toml`:

```bash
# 1. Deploy to staging
make api-deploy-staging

# 2. Run the app pointing to staging
make start-staging
```

**Case — `ok` (no banner, no modal):**

```toml
MINIMUM_APP_VERSION = "0.0.0"
```

**Case — `warn` (banner visible):**

```toml
MINIMUM_APP_VERSION = "2.0.0"
BLOCK_OLDER_VERSIONS = "false"
```

**Case — `block` (modal bloqueante):**

```toml
MINIMUM_APP_VERSION = "2.0.0"
BLOCK_OLDER_VERSIONS = "true"
```

**Case — grace (block downgraded to warn):**

```toml
MINIMUM_APP_VERSION = "2.0.0"
BLOCK_OLDER_VERSIONS = "true"
GRACE_PERIOD_START = "2026-06-25"
GRACE_PERIOD_END   = "2026-07-10"
```

> Set `GRACE_PERIOD_START` to yesterday and `GRACE_PERIOD_END` to tomorrow from today's date.

**Case — grace expired (back to block):**

```toml
MINIMUM_APP_VERSION = "2.0.0"
BLOCK_OLDER_VERSIONS = "true"
GRACE_PERIOD_START = "2026-06-01"
GRACE_PERIOD_END   = "2026-06-20"
```

Each change requires a redeploy: `make api-deploy-staging`.

## Platform support

| Platform | Target                     |
| -------- | -------------------------- |
| iOS      | Native via Expo dev client |
| Android  | Native via Expo dev client |
| Web      | Static output via Expo     |
