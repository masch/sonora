# Design: GitHub Actions CI Workflow Refactor

## Technical Approach

Replace 18+ inline `bun install` blocks with a single composite action (`.github/actions/setup/action.yml`) that wraps checkout@v5 → setup-bun@v2 → cache@v5 → `bun install --frozen-lockfile`. Strip `--minimum-release-age=0` (packages are 20+ days old — flag is dead code). Rename 9 files via `git mv` to `{category}-{app}-{env}.yml` and update `workflow_call` refs. Add `workflow_dispatch` inputs to `deploy-mobile-staging.yml` for conditional web/Android execution. Create 5 new workflows for coverage gaps. Deliver across 3 chained PRs.

## Architecture Decisions

### Composite action scope

| Option                                 | Tradeoff                                                             | Decision     |
| -------------------------------------- | -------------------------------------------------------------------- | ------------ |
| Include checkout + cache + bun install | Ensures consistent v5 checkout everywhere; needs `fetch-depth` input | **Accepted** |
| Keep checkout/cache in workflows       | Leaves v4/v5 inconsistency; more manual edits per file               | Rejected     |

### Cache key strategy

| Option                                        | Tradeoff                                                  | Decision     |
| --------------------------------------------- | --------------------------------------------------------- | ------------ |
| Single key `bun-${{ hashFiles('bun.lock') }}` | All 10 workflows share root lockfile — one key covers all | **Accepted** |
| Per-job or per-workflow keys                  | Over-engineered; same lockfile, same cache                | Rejected     |

### `--frozen-lockfile` edge case

| Option                                 | Tradeoff                                                                 | Decision                           |
| -------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| Add `frozen` input to composite action | Handles `expo-sdk-version-sync`'s non-frozen step; slightly more complex | **Accepted**                       |
| Keep non-frozen step inline            | Fewer composite-action callers; spec says "all 18"                       | Rejected — frozen input is cleaner |

### Naming convention

`{category}-{app}-{env}.yml` — categories: `ci`, `deploy`, `admin`. Apps: `mobile`, `admin`, `api`, `all`. Env omitted for CI-only files. Platform suffix (`web`, `android`) allowed within an app.

## Data Flow

```
Push / PR / Dispatch ──→ 14 workflow files (*.yml)
                               │
                ┌──────────────┴──────────────┐
                │                              │
        Uses composite action           No bun install
        .github/actions/setup           (socket.yml)
                │
        ┌───────┴──────────┐
        │                   │
   Cache hit           Cache miss
   (restore)        (install + save)
```

## File Changes

### PR 1: Composite action + bun install replacement + flag removal

| File                               | Action     | Description                                                                                                               |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.github/actions/setup/action.yml` | **Create** | Composite action: checkout@v5 + setup-bun@v2 + cache@v5 + `bun install` with `fetch-depth` (1) and `frozen` (true) inputs |
| `commitlint.yml`                   | Modify     | Replace inline bun with `uses: ./.github/actions/setup`; strip flag                                                       |
| `deploy-admin-production.yml`      | Modify     | Same replacement                                                                                                          |
| `deploy-admin-staging.yml`         | Modify     | Same                                                                                                                      |
| `deploy-android-production.yml`    | Modify     | 2 replacements (build + distribute jobs)                                                                                  |
| `deploy-api-production.yml`        | Modify     | Replace + upgrade checkout v4→v5                                                                                          |
| `deploy-api-staging.yml`           | Modify     | Replace inline bun                                                                                                        |
| `deploy-mobile-staging.yml`        | Modify     | 3 replacements + add `workflow_dispatch` inputs (`deploy_web`, `deploy_android`, `firebase_team`)                         |
| `deploy-web-production.yml`        | Modify     | Replace + strip flag                                                                                                      |
| `expo-sdk-version-sync.yml`        | Modify     | 1 replacement (frozen call); keep non-frozen inline with `frozen: false`                                                  |
| `pr.yml`                           | Modify     | 4 replacements + strip flag                                                                                               |
| `sync-translations.yml`            | Modify     | Replace + strip flag                                                                                                      |
| `validate-api-staging.yml`         | Modify     | Replace + strip flag + upgrade checkout v4→v5                                                                             |

### PR 2: File renames + ref updates

| File                                                                     | Action              | Description                                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commitlint.yml` → `ci-commitlint.yml`                                   | **Rename** (git mv) | CI check, no app/env                                                                                                                                                    |
| `pr.yml` → `ci-pr.yml`                                                   | **Rename**          | CI check, multi-app                                                                                                                                                     |
| `socket.yml` → `ci-socket.yml`                                           | **Rename**          | CI check, no app                                                                                                                                                        |
| `validate-api-staging.yml` → `ci-api.yml`                                | **Rename**          | CI validation, drops misnamed staging                                                                                                                                   |
| `deploy-web-production.yml` → `deploy-mobile-web-production.yml`         | **Rename**          | Disambiguate mobile web                                                                                                                                                 |
| `deploy-android-production.yml` → `deploy-mobile-android-production.yml` | **Rename**          | Platform-suffixed mobile deploy                                                                                                                                         |
| `deploy-production-manual.yml` → `deploy-all-production.yml`             | **Rename**          | Orchestrator, not manual-only                                                                                                                                           |
| `expo-sdk-version-sync.yml` → `admin-expo-sync.yml`                      | **Rename**          | Admin process                                                                                                                                                           |
| `sync-translations.yml` → `admin-sync-translations.yml`                  | **Rename**          | Admin process                                                                                                                                                           |
| `deploy-all-production.yml`                                              | Modify              | Update `workflow_call` refs: `deploy-web-production.yml` → `deploy-mobile-web-production.yml`, `deploy-android-production.yml` → `deploy-mobile-android-production.yml` |
| `admin-expo-sync.yml`                                                    | Modify              | Update `gh workflow run` refs to unchanged filenames (`deploy-mobile-staging.yml`, `deploy-admin-staging.yml`)                                                          |

### PR 3: 5 new workflows

| File                            | Action     | Description                                                                                                                                                               |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci-bundle-size.yml`            | **Create** | PR trigger → composite action → bundle size diff check                                                                                                                    |
| `ci-auto-assign.yml`            | **Create** | PR opened → path-based reviewer assignment via `shufo/auto-assign-reviewer-by-files`                                                                                      |
| `deploy-admin-staging-auto.yml` | **Create** | Push to main → composite action → `make eas-build-admin-staging` (auto variant of manual staging)                                                                         |
| `admin-cleanup.yml`             | **Create** | Monthly cron → stale issues/branches/artifact cleanup                                                                                                                     |
| `admin-db-backup.yml`           | **Create** | Weekly cron → pg_dump (schema+data) → gzip → GPG AES256 → R2 `db/` + rclone sync audio bucket → R2 `audio/latest/` + archive previous versions to `audio/archive/{date}/` |

## Interfaces / Contracts

**Composite action inputs** (`.github/actions/setup/action.yml`):

| Input         | Default | Description                                                                          |
| ------------- | ------- | ------------------------------------------------------------------------------------ |
| `fetch-depth` | `1`     | Git clone depth. `0` for full history (versionCode bumps, git describe)              |
| `frozen`      | `true`  | Whether to use `--frozen-lockfile`. `false` for lockfile-changed-after-install flows |

## Migration / Rollout

### PR delivery plan

```
PR 1 (composite action + replacements)     ← no deps
  │
  └── PR 2 (git mv + ref updates)          ← depends on PR 1
        │
        └── PR 3 (5 new workflows)          ← depends on PR 2
```

**PR 1** — Largest change (~250 modified lines across 12 files). Composite action replaces bun install everywhere; flag removed; checkout standardized to v5. Safe to merge independently — no behavior change, just structure.

**PR 2** — File renames via `git mv` preserve git history. `workflow_call` refs in `deploy-all-production.yml` updated. `admin-expo-sync.yml` `gh workflow run` refs updated. Must land after PR 1 to avoid re-editing renamed files.

**PR 3** — Creates 5 standalone workflow YAMLs. No modifications to existing files. Cleanest PR — trivial rollback (delete files).

### Rollback plan

| PR  | Rollback                                                            |
| --- | ------------------------------------------------------------------- |
| 1   | `git revert` — old inline code in history, composite action removed |
| 2   | `git revert` — renames reversed (`git mv` back), refs restored      |
| 3   | `git rm` the 5 new files — no pipeline impact                       |

## Testing Strategy

| Layer  | What to Test                               | Approach                                                               |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------- |
| CI     | Composite action works on all 10 workflows | Create a branch PR, verify all 14 workflows pass                       |
| CI     | Cache hit shortens execution               | Verify cache restore appears in logs (~20s saved per job)              |
| Manual | `deploy-mobile-staging` dispatch inputs    | Trigger workflow_dispatch with `deploy_web=false`, verify Android-only |
| Manual | Renamed workflow_call refs                 | Trigger `deploy-all-production` — verify it calls renamed files        |

## Open Questions

- [ ] Bundle size analysis tool — does the project have a `make bundle-size` target or need a new script?
- [ ] Auto-assign config — does the project use `CODEOWNERS` or a `.github/auto-assign.yml` config file?

### Resolved: db-backup decisions

| Question          | Decision                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Backup format     | `pg_dump` schema + data, compressed with gzip (`.sql.gz`)                                |
| Filename          | `sonora-db-{YYYY-MM-DD}.sql.gz` (timestamp)                                              |
| R2 bucket         | Dedicated bucket: `sonora-db-backups` (separate from audio bucket)                       |
| Encryption        | GPG symmetric AES256 — passphrase stored as `BACKUP_ENCRYPTION_KEY` secret               |
| DB retention      | Max 3 months with rotation (delete .sql.gz.gpg files older than 90 days)                 |
| Audio retention   | Forever — never delete audio archives                                                    |
| Audio backup tool | `rclone` with `--backup-dir` for incremental + version capture                           |
| Audio scheme      | `audio/latest/` (current) + `audio/archive/{date}/` (previous versions before overwrite) |
