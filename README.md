# Sonora

Universal Expo app targeting iOS, Android, and Web.

**Stack:** Expo SDK 56 · React Native 0.85 · TypeScript 6.0 · expo-router · Tailwind CSS v4 · Jest · Bun · Hono · Drizzle ORM · PostgreSQL

## Environments (Web Access)

### 🟢 Production

- **Mobile App (Web):** [https://sonoraderivapoeticas-team-sonora.expo.app/](https://sonoraderivapoeticas-team-sonora.expo.app/)
- **Admin Portal:** [https://sonora-admin.expo.app/](https://sonora-admin.expo.app/)

### 🟡 Staging (Preview builds)

- **Mobile App (Web):** [https://sonoraderivapoeticas-team-sonora--staging.expo.app/](https://sonoraderivapoeticas-team-sonora--staging.expo.app/)
- **Admin Portal:** [https://sonora-admin--staging.expo.app/](https://sonora-admin--staging.expo.app/)

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

> The canonical target list is generated from `make help`. This table may drift as new targets are added.

| Target                                  | Description                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Dev server**                          |                                                                                                   |
| `start`                                 | Launch Expo dev server                                                                            |
| `start-wrangler`                        | Expo dev server pointing to local wrangler (port 8787) for iOS/Web                                |
| `start-wrangler-android`                | Expo dev server pointing to local wrangler (port 8787) for Android emulator                       |
| `start-staging`                         | Expo dev server pointing to remote staging API                                                    |
| `start-headless`                        | Launch Expo dev server without interactive TTY                                                    |
| `dev-web`                               | Launch Expo dev server for web                                                                    |
| `dev-ios`                               | Launch Expo dev server for iOS                                                                    |
| `dev-android`                           | Launch Expo dev server for Android (Expo Go)                                                      |
| `kill-metro`                            | Kill any process running on Metro port 8081                                                       |
| **Admin**                               |                                                                                                   |
| `admin-dev`                             | Launch Expo dev server for Admin Web                                                              |
| `admin-dev-staging`                     | Admin dev server pointing to staging API                                                          |
| **Installation**                        |                                                                                                   |
| `install`                               | Install workspace dependencies + configure git hooks                                              |
| **Formatting**                          |                                                                                                   |
| `format`                                | Format code with Prettier                                                                         |
| `format-check`                          | Check code formatting using Prettier (no write)                                                   |
| **Testing**                             |                                                                                                   |
| `test-front`                            | Run frontend tests (Jest, one-shot)                                                               |
| `test-back` / `api-test`                | Run backend API tests (Vitest)                                                                    |
| `test-shared`                           | Run shared package tests (Bun)                                                                    |
| `test-admin`                            | Run admin app tests (Jest, one-shot)                                                              |
| `test`                                  | Run all tests (frontend + backend + shared + admin)                                               |
| `test-ci`                               | Run all tests silently (for pre-commit/CI)                                                        |
| `api-test-staging`                      | Test staging Worker health (GET /health)                                                          |
| `api-test-staging-verbose`              | Test staging Worker with full response                                                            |
| `api-test-production`                   | Test production Worker health (GET /health)                                                       |
| `api-test-staging-db`                   | Test staging DB connection (GET /health/db)                                                       |
| `api-test-production-db`                | Test production DB connection (GET /health/db)                                                    |
| `api-test-mp`                           | Run MercadoPago payment status polling test (local)                                               |
| `api-test-mp-staging`                   | Run MercadoPago payment status polling test against staging                                       |
| **Linting**                             |                                                                                                   |
| `lint`                                  | Run ESLint across all workspaces                                                                  |
| **Type checking**                       |                                                                                                   |
| `typecheck`                             | TypeScript type checks (mobile + api + admin)                                                     |
| `api-typecheck`                         | TypeScript type check for the API                                                                 |
| `scripts-typecheck`                     | Type-check scripts/ with tsc                                                                      |
| **Diagnostics**                         |                                                                                                   |
| `doctor`                                | Run React Doctor audit (full verbose scan)                                                        |
| `doctor-ci`                             | Run React Doctor audit (terse, for pre-commit)                                                    |
| `doctor-diff`                           | Run React Doctor audit on staged diff (regression check)                                          |
| `expo-doctor`                           | Run Expo Doctor to verify dependency compatibility                                                |
| **Validation**                          |                                                                                                   |
| `validate`                              | Full development gate: format → test → lint → typecheck → api-typecheck → scripts-typecheck → gga |
| `check`                                 | CI verification gate: format-check → test → lint → typecheck → expo-doctor                        |
| `api-validate`                          | API tests + typecheck                                                                             |
| **Review**                              |                                                                                                   |
| `gga`                                   | Run GGA (Gentleman Guardian Angel) code review on staged files                                    |
| `gga-full`                              | Run GGA on ALL matching source files (stages, reviews, unstages)                                  |
| **Native builds**                       |                                                                                                   |
| `rebuild-android`                       | Rebuild native Android project (after adding native modules)                                      |
| `rebuild-ios`                           | Rebuild native iOS project                                                                        |
| `prebuild`                              | Regenerate native project files without compiling                                                 |
| **EAS builds**                          |                                                                                                   |
| `eas-whoami`                            | Verify EAS authentication                                                                         |
| `eas-list`                              | List recent EAS builds                                                                            |
| `eas-init`                              | Initialize EAS for this project                                                                   |
| `eas-build-android`                     | Build Play Store APK via EAS cloud                                                                |
| `eas-build-android-preview`             | Build test APK for sideload via EAS cloud                                                         |
| `eas-build-android-local`               | Build Play Store APK locally                                                                      |
| `eas-build-android-preview-local`       | Build test APK locally (interactive)                                                              |
| `eas-build-android-preview-ci`          | Build test APK for sideload in CI                                                                 |
| `eas-build-android-aab-ci`              | Build signed AAB in CI                                                                            |
| `eas-build-android-release-ci-unsigned` | Build unsigned APK + AAB from prebuild+Gradle                                                     |
| `eas-upload-apk`                        | Upload a local APK to EAS Submit                                                                  |
| `eas-build-web-production`              | Export web app and deploy to EAS Hosting production                                               |
| `eas-build-web-staging`                 | Export web app and deploy to EAS Hosting staging                                                  |
| `eas-build-admin-production`            | Export admin web app and deploy to EAS Hosting production                                         |
| `eas-build-admin-staging`               | Export admin web app and deploy to EAS Hosting staging                                            |
| **Supply chain security**               |                                                                                                   |
| `socket-login`                          | Authenticate with Socket.dev CLI                                                                  |
| `socket-scan`                           | Run Socket.dev security scan                                                                      |
| `pin-deps`                              | Pin all workspace deps to exact versions from bun.lock                                            |
| **Firebase App Distribution**           |                                                                                                   |
| `firebase-login-ci`                     | Firebase CI login (generates FIREBASE_TOKEN)                                                      |
| `firebase-distribute`                   | Upload APK to Firebase App Distribution                                                           |
| `firebase-distribute-staging-dev`       | Upload to staging dev-team group                                                                  |
| `firebase-distribute-staging-sonora`    | Upload to staging sonora-team group                                                               |
| `firebase-distribute-staging-all`       | Upload to staging both groups                                                                     |
| `firebase-distribute-prod-dev`          | Upload to production dev-team group                                                               |
| `firebase-distribute-prod-sonora`       | Upload to production sonora-team group                                                            |
| `firebase-distribute-prod-all`          | Upload to production both groups                                                                  |
| **Backend API — Database**              |                                                                                                   |
| `api-db-up`                             | Start Postgres (Podman)                                                                           |
| `api-db-down`                           | Stop Postgres (Podman)                                                                            |
| `api-db-generate`                       | Generate Drizzle migration from schema changes                                                    |
| `api-db-migrate`                        | Apply pending Drizzle migrations (local)                                                          |
| `api-db-migrate-ci`                     | Apply migrations using DATABASE_URL from env (for CI)                                             |
| `api-db-migrate-staging`                | Apply migrations to staging Neon DB                                                               |
| `api-db-migrate-production`             | Apply migrations to production Neon DB                                                            |
| `api-db-seed`                           | Seed default trips data in local Postgres                                                         |
| `api-db-seed-ci`                        | Seed DB using DATABASE_URL from env (for CI)                                                      |
| `api-db-seed-staging`                   | Seed staging Neon DB                                                                              |
| `api-db-seed-production`                | Seed production Neon DB                                                                           |
| `api-db-studio`                         | Launch Drizzle Studio (GUI database browser)                                                      |
| `api-db-shell`                          | Open psql shell to local Postgres                                                                 |
| `api-db-shell-staging`                  | Open psql shell to Neon staging DB                                                                |
| `api-db-shell-production`               | Open psql shell to Neon production DB                                                             |
| `api-db-backup`                         | Dump, encrypt with GPG, upload to R2, prune old backups                                           |
| `api-db-restore`                        | Download and restore database backup from R2                                                      |
| **Backend API — Dev server**            |                                                                                                   |
| `api-install`                           | Install API dependencies (--frozen-lockfile)                                                      |
| `api-dev`                               | Run API locally with wrangler dev                                                                 |
| `api-dev-local`                         | Run API locally with Docker Postgres                                                              |
| `api-dev-full`                          | Start Postgres → migrate → seed → run API                                                         |
| `api-dev-remote-staging`                | Run API locally connected to remote staging R2/resources                                          |
| `api-dev-staging`                       | Run API locally with wrangler dev + staging Neon DB                                               |
| `api-dev-local`                         | Run Hono API locally with Docker Postgres                                                         |
| **Backend API — Deploy**                |                                                                                                   |
| `api-deploy` / `api-deploy-production`  | Deploy production Worker to Cloudflare                                                            |
| `api-deploy-production-secrets`         | Set secrets on production Worker                                                                  |
| `api-deploy-production-full`            | All-in-one: migrate → seed → deploy → secrets (production)                                        |
| `api-deploy-production-set-origin`      | Set ALLOWED_ORIGIN on production Worker                                                           |
| `api-deploy-production-log-toggle`      | Toggle API logging on production                                                                  |
| `api-deploy-staging`                    | Deploy staging Worker to Cloudflare                                                               |
| `api-deploy-staging-secrets`            | Set secrets on staging Worker                                                                     |
| `api-deploy-staging-full`               | All-in-one: migrate → seed → deploy → secrets (staging)                                           |
| `api-deploy-staging-set-origin`         | Set ALLOWED_ORIGIN on staging Worker                                                              |
| `api-deploy-staging-log-toggle`         | Toggle API logging on staging                                                                     |
| `api-login`                             | Authenticate wrangler with Cloudflare                                                             |
| `api-logs-staging`                      | Tail staging Worker logs                                                                          |
| `api-logs-production`                   | Tail production Worker logs                                                                       |
| `api-secrets-staging`                   | List staging Worker secrets                                                                       |
| `api-secrets-production`                | List production Worker secrets                                                                    |
| **R2 Audio Storage**                    |                                                                                                   |
| `api-r2-buckets-staging`                | Create R2 audio buckets for staging                                                               |
| `api-r2-buckets-production`             | Create R2 audio buckets for production                                                            |
| `api-upload-audio-staging`              | Upload audio file to staging R2                                                                   |
| `api-upload-audio-production`           | Upload audio file to production R2                                                                |
| **Translations**                        |                                                                                                   |
| `sync-translations-staging`             | Dry-run sync translations from staging DB                                                         |
| `sync-translations-staging-apply`       | Write translations from staging DB to .ts files                                                   |
| `sync-translations-production`          | Dry-run sync translations from production DB                                                      |
| **Android emulator**                    |                                                                                                   |
| `android-stop`                          | Stop the standalone app on emulator                                                               |
| `android-stop-go`                       | Stop Expo Go on emulator                                                                          |
| `android-trigger-bg`                    | Trigger background fetch for standalone app                                                       |
| `android-trigger-bg-go`                 | Trigger background fetch in Expo Go                                                               |
| `android-reset`                         | Reset emulator (wipe data)                                                                        |
| `android-restart`                       | Restart emulator                                                                                  |
| `android-kill`                          | Kill emulator (force)                                                                             |
| **Expo upgrade**                        |                                                                                                   |
| `expo-upgrade`                          | Check recommended versions and upgrade Expo SDK packages                                          |
| **Maintenance**                         |                                                                                                   |
| `clean`                                 | Remove build artifacts and node_modules                                                           |
| `eas-clean`                             | Clean EAS cache + APKs + Podman EAS images + Expo caches                                          |
| `eas-clean-full`                        | Clean everything (including Gradle cache + prebuild)                                              |
| `reset`                                 | Full reset: clean + reinstall                                                                     |
| `precommit-logs`                        | Show temp files from last pre-commit run                                                          |
| `help`                                  | Print all targets                                                                                 |

### Validation pipeline

A **git pre-commit hook** (`.githooks/pre-commit`) runs on every commit and executes these steps in order:

1. **format-check** — Prettier checks formatting; auto-fixes and stages files if needed
2. **test-ci** — All tests (Jest + Vitest) with silent output
3. **lint** — ESLint across all workspaces
4. **typecheck** — TypeScript compiler check (mobile + api + admin)
5. **doctor-ci** — React Doctor audit
6. **expo-doctor** — Expo dependency compatibility check (non-blocking — known false positives with Bun)
7. **gga** — AI code review on staged files

If any blocking step fails, the commit is rejected.

The `validate` target (`make validate`: `format` → `test` → `lint` → `typecheck` → `api-typecheck` → `scripts-typecheck` → `gga`) can be run manually for the same development gate.

## Project structure

```text
sonora/
├── apps/
│   ├── mobile/          # Expo mobile app (iOS, Android, Web)
│   │   └── src/
│   │       ├── app/           # expo-router file-based routes
│   │       ├── components/    # Reusable UI components
│   │       ├── config/        # App configuration
│   │       ├── constants/     # App constants
│   │       ├── data/          # Static data
│   │       ├── hooks/         # Custom React hooks
│   │       ├── i18n/          # Internationalization
│   │       ├── services/      # API service layer
│   │       ├── storage/       # Local storage
│   │       ├── store/         # State management (Zustand)
│   │       ├── tw/            # Tailwind utility components
│   │       ├── types/         # TypeScript type definitions
│   │       ├── utils/         # Utility functions
│   │       ├── __tests__/     # Test suites
│   │       └── global.css     # Global styles
│   ├── __mocks__/             # Jest mocks (react-i18next, reanimated, etc.)
│   ├── api/                   # Hono backend (Cloudflare Workers + Neon)
│   │   └── src/
│   │       ├── db/            # Drizzle ORM schema & migrations
│   │       ├── lib/           # Library code (HttpClient, etc.)
│   │       ├── middleware/    # Hono middleware
│   │       ├── payments/      # MercadoPago integration
│   │       ├── routes/        # API route handlers
│   │       ├── scripts/       # Utility scripts
│   │       ├── utils/         # Utility functions
│   │       ├── index.ts       # Worker entry point
│   │       ├── server.local.ts
│   │       └── __tests__/     # Test suites
│   └── admin/                 # Admin web portal (Expo)
│       └── src/
│           ├── app/           # expo-router routes
│           ├── components/    # UI components
│           ├── config/
│           ├── constants/
│           ├── hooks/
│           ├── i18n/
│           ├── services/
│           └── tw/
├── packages/
│   └── shared/                # Shared types, utilities, constants
├── openspec/                  # SDD/gentle-ai artifacts
│   ├── changes/
│   ├── config.yaml
│   ├── designs/
│   ├── specs/
│   └── tasks/
├── docs/                      # Documentation
├── scripts/                   # Root-level utility scripts
├── scratch/                   # Temporary/scratch files
├── .githooks/
│   └── pre-commit             # Git pre-commit hook
├── .engram/
│   └── config.json
├── Makefile
├── package.json               # Bun workspace root
├── bunfig.toml
└── renovate.json
```

## API — Feedback Database

The backend API (`apps/api/`) stores feedback in Postgres. Two runtimes are supported: local development with Podman, and production on Cloudflare Workers with Neon.

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
cd apps/api && npx wrangler secret put NEON_DATABASE_URL
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

## Dependency Management & Security

### Version pinning

All workspace `package.json` files use **exact pinned versions** (no `^`, `~`, or `*`). This ensures deterministic installs and lets Dependabot correctly identify advisory status.

**`scripts/pin-deps.ts`** is a one-time script that replaces any range specifier with the exact resolved version from `bun.lock`.

| When                                   | Why                                                                     | How             |
| -------------------------------------- | ----------------------------------------------------------------------- | --------------- |
| **Never in daily work**                | Renovate already creates PRs with exact versions (`rangeStrategy: pin`) | —               |
| **After a manual `bun add`**           | You added a dependency without an exact version                         | `make pin-deps` |
| **After editing package.json by hand** | You accidentally added a `^` or `*`                                     | `make pin-deps` |
| **When bootstrapping a new workspace** | To pin all new dependencies cleanly                                     | `make pin-deps` |

### Renovate

We use **Renovate Community Cloud** (free tier) for automated dependency updates. Configuration in `renovate.json`:

- `enabledManagers: ["bun"]` — Bun-only, won't interfere with other managers
- `rangeStrategy: "pin"` — updates use exact versions (no caret)
- `schedule: ["before 6am on Monday"]` — weekly
- `dependencyDashboard: true` — visibility into all pending updates

**Post-merge:** install the [Renovate GitHub App](https://github.com/apps/renovate) on the repository.

### Security audit

The `.github/workflows/security-audit.yml` workflow runs `bun audit` weekly (Monday 06:00 UTC) and supports manual execution via `workflow_dispatch`.

| Feature           | Detail                                                          |
| ----------------- | --------------------------------------------------------------- |
| Default threshold | `moderate` (configurable: low/moderate/high/critical)           |
| Output            | `$GITHUB_STEP_SUMMARY` with findings table                      |
| Issue creation    | Optional, only on `workflow_dispatch` with `create-issue: true` |
| Fallback          | If `bun audit --format=json` fails, parses plain text           |
