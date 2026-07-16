# Spec: README Refresh

**Change**: `readme-refresh`
**Based on**: proposal

## Sections to update

### 1. Project structure (lines ~67–82)

Replace the flat `src/` tree with the actual monorepo layout:

```
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
│   ├── api/                   # Hono backend (Cloudflare Workers)
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
│   └── pre-commit
├── .engram/
│   └── config.json
├── Makefile
├── package.json               # Bun workspace root
├── bunfig.toml
└── renovate.json
```

### 2. API section (lines ~93–166)

- Change all `api/` references to `apps/api/`:
  - `cd api` → `cd apps/api`
  - `api/` directory references → `apps/api/`
  - Makefile targets like `api-dev-local`, `api-deploy` already work from root, but the doc section should reference `apps/api/` for clarity
- Keep the API environment variables table
- Keep the manual testing section (version check)

### 3. Validation pipeline (lines ~56–65)

Replace with what the actual pre-commit hook runs:

```markdown
### Validation pipeline

The `validate` target (`make validate`) runs on every commit via a **git pre-commit hook** (`.githooks/pre-commit`). It executes these steps in order:

1. **format-check** — Prettier checks formatting; auto-fixes and stages files if needed
2. **test-ci** — All tests (Jest + Vitest) with silent output
3. **lint** — ESLint across all workspaces
4. **typecheck** — TypeScript compiler check (mobile + api + admin)
5. **doctor-ci** — React Doctor audit
6. **expo-doctor** — Expo dependency compatibility check (non-blocking — known false positives with Bun)
7. **gga** — AI code review on staged files

If any blocking step fails, the commit is rejected.
```

### 4. Makefile targets table (lines ~34–55)

Add missing targets. Current table has these targets that exist in Makefile:

**Missing from table:**

| Target                                  | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| `start-wrangler`                        | Expo dev server pointing to local wrangler (port 8787)    |
| `start-wrangler-android`                | Expo dev server pointing to wrangler for Android emulator |
| `start-staging`                         | Expo dev server pointing to staging API                   |
| `start-headless`                        | Start dev server without interactive TTY                  |
| `admin-dev`                             | Launch Admin Web dev server                               |
| `admin-dev-staging`                     | Admin dev server pointing to staging API                  |
| `test-shared`                           | Run shared package tests                                  |
| `test-admin`                            | Run admin app tests                                       |
| `test-ci`                               | Run all tests silently (for CI/pre-commit)                |
| `doctor-ci`                             | React Doctor audit (terse, for pre-commit)                |
| `validate`                              | Full development gate                                     |
| `check`                                 | CI verification gate                                      |
| `api-validate`                          | API tests + typecheck                                     |
| `api-test-staging`                      | Test staging Worker health                                |
| `api-test-production`                   | Test production Worker health                             |
| `precommit-logs`                        | Show logs from last pre-commit run                        |
| `api-r2-buckets-staging`                | Create R2 audio buckets for staging                       |
| `api-r2-buckets-production`             | Create R2 audio buckets for production                    |
| `api-upload-audio-staging`              | Upload audio to staging R2                                |
| `api-upload-audio-production`           | Upload audio to production R2                             |
| `api-secrets-staging`                   | List staging Worker secrets                               |
| `api-secrets-production`                | List production Worker secrets                            |
| `api-test-staging-db`                   | Test staging DB connection                                |
| `api-test-production-db`                | Test production DB connection                             |
| `api-db-seed`                           | Seed default trips in local Postgres                      |
| `api-db-migrate-staging`                | Apply migrations to staging Neon                          |
| `api-db-migrate-production`             | Apply migrations to production Neon                       |
| `api-deploy-staging-full`               | All-in-one: migrate → seed → deploy → secrets staging     |
| `api-deploy-production-full`            | All-in-one: migrate → seed → deploy → secrets production  |
| `api-test-mp`                           | Run MercadoPago polling test locally                      |
| `api-test-mp-staging`                   | Run MP polling test against staging                       |
| `sync-translations-staging`             | Dry-run sync translations from staging                    |
| `sync-translations-staging-apply`       | Write translations from staging                           |
| `sync-translations-production`          | Dry-run sync translations from production                 |
| `firebase-login-ci`                     | Firebase CI login                                         |
| `firebase-distribute`                   | Upload APK to Firebase App Distribution                   |
| `firebase-distribute-staging-dev`       | Upload to staging dev-team                                |
| `firebase-distribute-staging-sonora`    | Upload to staging sonora-team                             |
| `firebase-distribute-staging-all`       | Upload to staging both groups                             |
| `firebase-distribute-prod-dev`          | Upload to production dev-team                             |
| `firebase-distribute-prod-sonora`       | Upload to production sonora-team                          |
| `firebase-distribute-prod-all`          | Upload to production both groups                          |
| `kill-metro`                            | Kill process on Metro port 8081                           |
| `rebuild-android`                       | Rebuild native Android project                            |
| `rebuild-ios`                           | Rebuild native iOS project                                |
| `prebuild`                              | Regenerate native project files                           |
| `doctor`                                | Run React Doctor audit (full)                             |
| `expo-doctor`                           | Expo dependency compatibility check                       |
| `expo-upgrade`                          | Check/upgrade Expo SDK packages                           |
| `socket-login`                          | Authenticate with Socket.dev                              |
| `socket-scan`                           | Run Socket.dev security scan                              |
| `pin-deps`                              | Pin workspace deps to exact versions                      |
| `scripts-typecheck`                     | Type-check scripts/                                       |
| `api-install`                           | Install API dependencies                                  |
| `api-dev`                               | Run API locally with wrangler                             |
| `api-dev-remote-staging`                | Run API with remote staging resources                     |
| `api-dev-staging`                       | Run API with staging Neon                                 |
| `api-deploy-production`                 | Deploy production Worker                                  |
| `api-deploy-production-secrets`         | Set secrets on production Worker                          |
| `api-deploy-staging`                    | Deploy staging Worker                                     |
| `api-deploy-staging-secrets`            | Set secrets on staging Worker                             |
| `api-deploy-staging-set-origin`         | Set ALLOWED_ORIGIN on staging                             |
| `api-deploy-production-set-origin`      | Set ALLOWED_ORIGIN on production                          |
| `api-deploy-staging-log-toggle`         | Toggle logging on staging                                 |
| `api-deploy-production-log-toggle`      | Toggle logging on production                              |
| `api-db-backup`                         | Dump, encrypt, upload DB to R2                            |
| `api-db-restore`                        | Download and restore DB from R2                           |
| `api-db-shell-staging`                  | psql shell to staging Neon                                |
| `api-db-shell-production`               | psql shell to production Neon                             |
| `api-dev-local`                         | Run API locally with Docker Postgres                      |
| `api-dev-full`                          | Postgres + migrate + seed + API                           |
| `api-logs-staging`                      | Tail staging Worker logs                                  |
| `api-logs-production`                   | Tail production Worker logs                               |
| `format`                                | Format code with Prettier                                 |
| `format-check`                          | Check formatting without writing                          |
| `install`                               | Install deps + configure git hooks                        |
| `lint`                                  | Run ESLint across workspaces                              |
| `typecheck`                             | TypeScript type checks                                    |
| `test-front`                            | Mobile tests                                              |
| `test-back`                             | Backend tests (alias for api-test)                        |
| `test`                                  | All tests                                                 |
| `eas-whoami`                            | Verify EAS authentication                                 |
| `eas-list`                              | List recent EAS builds                                    |
| `eas-init`                              | Initialize EAS project                                    |
| `eas-build-android`                     | Build Play Store APK via EAS                              |
| `eas-build-android-preview`             | Build test APK via EAS                                    |
| `eas-build-android-local`               | Build APK locally                                         |
| `eas-build-android-preview-local`       | Build test APK locally                                    |
| `eas-build-android-release-ci-unsigned` | Build unsigned APK+AAB from CI                            |
| `eas-build-android-preview-ci`          | Build test APK in CI                                      |
| `eas-build-android-aab-ci`              | Build signed AAB in CI                                    |
| `eas-upload-apk`                        | Upload local APK to EAS                                   |
| `eas-build-web-production`              | Deploy web to EAS production                              |
| `eas-build-web-staging`                 | Deploy web to EAS staging                                 |
| `eas-build-admin-production`            | Deploy admin to EAS production                            |
| `eas-build-admin-staging`               | Deploy admin to EAS staging                               |
| `clean`                                 | Remove build artifacts                                    |
| `eas-clean`                             | Clean EAS + APK + caches                                  |
| `eas-clean-full`                        | Clean everything                                          |
| `reset`                                 | Full reset                                                |
| `help`                                  | Print all targets                                         |

### 5. GGA references throughout

- Keep all GGA mentions
- Align with Makefile: `gga run` (as in `make gga`)
- In validation pipeline section, show gga as the final step (as in actual hook)

### 6. Environment links (lines ~10–20)

Verify the Expo URLs are still current. Production and staging links for mobile web and admin portal.

## Unchanged sections

- Prerequisites (bun, make, gga)
- Setup (`make install`)
- Development commands (`make`, `make dev-web`, etc.)
- App Version Check section (complete and accurate)
- Platform support table
- Dependency management & security section (Renovate, pin-deps, security audit)
- API environment variables table
- Manual testing section (version states)
