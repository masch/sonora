# Tasks: GitHub Actions CI Workflow Refactor

## Review Workload Forecast

| Field                   | Value                 |
| ----------------------- | --------------------- |
| Estimated changed lines | ~550–700 across 3 PRs |
| 400-line budget risk    | High                  |
| Chained PRs recommended | Yes                   |
| Suggested split         | PR 1 → PR 2 → PR 3    |
| Delivery strategy       | ask-on-risk           |
| Chain strategy          | pending               |

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal                                                      | Likely PR | Notes                                            |
| ---- | --------------------------------------------------------- | --------- | ------------------------------------------------ |
| 1    | Composite action + bun install replacement + flag removal | PR 1      | base=feature/gh-ci-refactor; standalone, no deps |
| 2    | File renames via `git mv` + update workflow_call refs     | PR 2      | base=PR 1 branch; depends on PR 1                |
| 3    | 5 new workflow files                                      | PR 3      | base=PR 2 branch; depends on PR 2                |

## PR 1: Composite Action + bun install replacement

- [x] 1.1 Create `.github/actions/setup/action.yml` — checkout@v5 + setup-bun@v2 + cache@v5 + `bun install --frozen-lockfile`, `fetch-depth` (1) / `frozen` (true) inputs
- [x] 1.2 Replace bun install + strip `--minimum-release-age=0` in `commitlint.yml`, `deploy-admin-production.yml`, `deploy-admin-staging.yml`, `deploy-web-production.yml`, `sync-translations.yml`
- [x] 1.3 Replace bun install + upgrade checkout v4→v5 in `deploy-api-production.yml`, `validate-api-staging.yml`; replace in `deploy-api-staging.yml`
- [x] 1.4 Replace 2x bun install in `deploy-android-production.yml` (build + distribute jobs)
- [x] 1.5 Replace 4x bun install in `pr.yml`, strip `--minimum-release-age=0`
- [x] 1.6 Replace 3x bun install in `deploy-mobile-staging.yml` + add `workflow_dispatch` inputs (`deploy_web`, `deploy_android`, `firebase_team`)
- [x] 1.7 Replace 1x bun install in `expo-sdk-version-sync.yml` with `frozen: true`, keep non-frozen step with `frozen: false`

## PR 2: File renames + ref updates

- [ ] 2.1 `git mv` 9 workflow files to `{category}-{app}(-{env})(-{platform}).yml` convention
- [ ] 2.2 Update `workflow_call` refs in `deploy-all-production.yml` to renamed file targets
- [ ] 2.3 Update `gh workflow run` refs in `admin-expo-sync.yml` to use renamed filenames
- [ ] 2.4 Verify `gh workflow run` refs in remaining unchanged files target correct renamed paths

## PR 3: 5 new workflows

- [ ] 3.1 Create `ci-bundle-size.yml` — PR trigger, composite action, bundle size diff threshold
- [ ] 3.2 Create `ci-auto-assign.yml` — PR events, path-based reviewer auto-assignment
- [ ] 3.3 Create `deploy-admin-staging-auto.yml` — push to main, auto-deploy admin web staging
- [ ] 3.4 Create `admin-cleanup.yml` — monthly cron, stale issues/branches/artifacts cleanup
- [ ] 3.5 Create `admin-db-backup.yml` — weekly cron with two backup stages: (a) **DB**: `pg_dump` (schema+data) → gzip → GPG AES256 → `wrangler r2 object put` to `sonora-db-backups/db/sonora-db-{date}.sql.gz.gpg`, delete `.sql.gz.gpg` older than 90 days; (b) **Audio**: rclone copy r2:audio-bucket → r2:sonora-db-backups/audio/latest/ with `--backup-dir r2:sonora-db-backups/audio/archive/{date}/`, never delete

## Verification

- [ ] 4.1 Create test branch PR, verify all 14 workflows pass with composite action + renamed files
- [ ] 4.2 Manual: trigger `deploy-mobile-staging` with `deploy_web=false`, verify Android-only jobs
- [ ] 4.3 Manual: trigger `deploy-all-production`, verify `workflow_call` calls renamed files
