# SDD Exploration: GitHub Actions CI Workflow Refactor

Explored: 2026-07-05

## Executive Summary

The Sonora project has 14 GitHub Actions workflow files with significant inconsistencies in naming, structure, and duplication. The most impactful change is creating a composite action for `bun install` (Issue #229), which appears **18 times** across 10 workflows. Naming conventions vary wildly (`commitlint.yml`, `pr.yml`, `socket.yml`, `deploy-production-manual.yml`), without any category prefix, app target, or consistent environment indicator. The `deploy-mobile-staging.yml` bundles web + Android but production splits them across separate files. One workflow (`validate-api-staging.yml`) is misnamed — it validates on PRs, not in a staging environment. The empty `.github/actions/` directory is ready for the composite action.

---

## Workflow Inventory

| #   | File                            | Name                               | Lines | Trigger(s)                 | Env          | App Target       | Purpose                                           |
| --- | ------------------------------- | ---------------------------------- | ----- | -------------------------- | ------------ | ---------------- | ------------------------------------------------- |
| 1   | `commitlint.yml`                | Commitlint                         | 24    | PR + manual                | —            | —                | Validate PR title conventional commits            |
| 2   | `deploy-admin-production.yml`   | Deploy Admin Production            | 25    | manual + workflow_call     | production   | admin            | Deploy admin web to EAS Hosting                   |
| 3   | `deploy-admin-staging.yml`      | Deploy Admin Staging               | 24    | manual                     | staging      | admin            | Deploy admin web to EAS Hosting staging           |
| 4   | `deploy-android-production.yml` | Deploy Android Production          | 118   | manual + workflow_call     | production   | mobile (android) | Build + Firebase distribute Android APK           |
| 5   | `deploy-api-production.yml`     | Deploy API Production              | 32    | manual + workflow_call     | production   | api              | Deploy API Worker + DB migrate/seed               |
| 6   | `deploy-api-staging.yml`        | Deploy API Staging                 | 46    | manual + push to main      | staging      | api              | Deploy API staging Worker + DB migrate/seed       |
| 7   | `deploy-mobile-staging.yml`     | Deploy Mobile Staging              | 141   | manual                     | staging      | mobile           | Deploy web + Android staging                      |
| 8   | `deploy-production-manual.yml`  | Deploy Production (API & Mobile)   | 70    | manual + schedule (3d)     | production   | all              | Orchestrator: chains web→api→android production   |
| 9   | `deploy-web-production.yml`     | Deploy Web Production              | 33    | manual + workflow_call     | production   | mobile (web)     | Deploy mobile web to EAS Hosting                  |
| 10  | `expo-sdk-version-sync.yml`     | Expo SDK Version Sync              | 129   | schedule (weekly) + manual | —            | mobile + admin   | Check/fix Expo SDK versions, create PR            |
| 11  | `pr.yml`                        | PR Check                           | 105   | PR + manual                | —            | all              | Format + validate mobile/api/admin on PRs         |
| 12  | `socket.yml`                    | Socket Security                    | 24    | PR + manual                | —            | —                | Socket.dev supply chain security scan             |
| 13  | `sync-translations.yml`         | Sync Translations from Admin Panel | 99    | schedule (weekly) + manual | —            | api              | Sync DB translation overrides → locale files + PR |
| 14  | `validate-api-staging.yml`      | Validate API Staging               | 51    | PR (api paths to main)     | — (misnamed) | api              | Broader API validation suite on PRs               |

---

## Naming Analysis

### Current Inconsistencies

| Problem                                   | Examples                                                       | Count |
| ----------------------------------------- | -------------------------------------------------------------- | ----- |
| No category prefix                        | `commitlint.yml`, `pr.yml`, `socket.yml`                       | 3     |
| "Android" instead of "mobile"             | `deploy-android-production.yml`                                | 1     |
| "Web" ambiguous (mobile web vs admin web) | `deploy-web-production.yml` (is mobile web)                    | 1     |
| Orchestrator misleadingly named "manual"  | `deploy-production-manual.yml` (also schedule + workflow_call) | 1     |
| "Staging" in name but runs on PRs         | `validate-api-staging.yml` (validates, doesn't deploy)         | 1     |
| Overly long name                          | `expo-sdk-version-sync.yml`                                    | 1     |
| Too short/underspecified                  | `pr.yml`, `socket.yml`                                         | 2     |

### Proposed Naming Convention

`{category}-{app}-{env}.yml`

**Categories**: `ci` (PR checks / quality), `deploy` (deployments), `admin` (maintenance processes)

**Apps**: `mobile`, `admin`, `api`, `all` (cross-app)

**Env**: `production`, `staging`, omit for CI-only

**Proposed renames**:

| Current                         | Proposed                               | Rationale                               |
| ------------------------------- | -------------------------------------- | --------------------------------------- |
| `commitlint.yml`                | `ci-commitlint.yml`                    | CI check, no app/env                    |
| `pr.yml`                        | `ci-pr.yml`                            | CI check, multi-app                     |
| `socket.yml`                    | `ci-socket.yml`                        | CI check, no app                        |
| `validate-api-staging.yml`      | `ci-api.yml`                           | CI check, API app, no env (misnamed)    |
| `deploy-web-production.yml`     | `deploy-mobile-web-production.yml`     | Disambiguates mobile web from admin web |
| `deploy-android-production.yml` | `deploy-mobile-android-production.yml` | Consistent with mobile app prefix       |
| `deploy-production-manual.yml`  | `deploy-all-production.yml`            | Orchestrator, not manual-only           |
| `expo-sdk-version-sync.yml`     | `admin-expo-sync.yml`                  | Admin process, concise                  |
| `sync-translations.yml`         | `admin-sync-translations.yml`          | Admin process                           |
| `deploy-admin-production.yml`   | (keep)                                 | Already conforms                        |
| `deploy-admin-staging.yml`      | (keep)                                 | Already conforms                        |
| `deploy-api-production.yml`     | (keep)                                 | Already conforms                        |
| `deploy-api-staging.yml`        | (keep)                                 | Already conforms                        |
| `deploy-mobile-staging.yml`     | (keep)                                 | Already conforms                        |

---

## Duplication Analysis

### `bun install` — 18 occurrences across 10 workflows

| Workflow                        | Occurrences                             | Flag `--minimum-release-age=0`   |
| ------------------------------- | --------------------------------------- | -------------------------------- |
| `commitlint.yml`                | 1                                       | No                               |
| `deploy-admin-production.yml`   | 1                                       | Yes                              |
| `deploy-admin-staging.yml`      | 1                                       | Yes                              |
| `deploy-android-production.yml` | **2** (build + firebase jobs)           | Yes                              |
| `deploy-api-production.yml`     | 1                                       | No                               |
| `deploy-api-staging.yml`        | 1                                       | No                               |
| `deploy-mobile-staging.yml`     | **3** (web + android + distribute jobs) | Yes                              |
| `deploy-web-production.yml`     | 1                                       | Yes                              |
| `expo-sdk-version-sync.yml`     | 2 (check + fix)                         | Mixed (1 with frozen, 1 without) |
| `pr.yml`                        | **4** (format + 3 validate jobs)        | Yes                              |
| `sync-translations.yml`         | 1                                       | Yes                              |
| `validate-api-staging.yml`      | 1                                       | No                               |

**Total: 18 occurrences → single composite action replaces all**

### Other duplicated patterns

| Pattern                           | Occurrences    | Notes                                                 |
| --------------------------------- | -------------- | ----------------------------------------------------- |
| `actions/checkout`                | Every workflow | Version inconsistent: v4 (3), v5 (11)                 |
| `oven-sh/setup-bun`               | 10 workflows   | Always paired with bun install                        |
| `make check`                      | 3 workflows    | mobile-web, mobile-staging, android-production        |
| `make api-validate`               | 3 workflows    | api-production, api-staging, ci-api                   |
| `actions/setup-java` + Java build | 2 workflows    | android-production, mobile-staging — nearly identical |
| Firebase distribution             | 2 workflows    | android-production, mobile-staging — nearly identical |

### Notable: `socket.yml` does NOT use `bun install`

The Socket.dev action is self-contained — no dependency install needed. Cache opportunity doesn't apply.

---

## Environment & App Differentiation

### Current State

| App             | Production                                                                                                                           | Staging                                              | CI                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------- |
| **mobile**      | `deploy-web-production.yml` (web only) + `deploy-android-production.yml` (android only) + `deploy-all-production.yml` (orchestrator) | `deploy-mobile-staging.yml` (web + android together) | `pr.yml` (validate-mobile)                                    |
| **admin**       | `deploy-admin-production.yml`                                                                                                        | `deploy-admin-staging.yml`                           | `pr.yml` (validate-admin)                                     |
| **api**         | `deploy-api-production.yml`                                                                                                          | `deploy-api-staging.yml`                             | `pr.yml` (validate-api) + `ci-api.yml` (validate-api-staging) |
| **cross-app**   | `deploy-all-production.yml`                                                                                                          | —                                                    | `ci-pr.yml`, `ci-commitlint.yml`, `ci-socket.yml`             |
| **maintenance** | —                                                                                                                                    | —                                                    | `admin-expo-sync.yml`, `admin-sync-translations.yml`          |

### Gaps

1. **Mobile production is split** across `deploy-web-production.yml` (web) and `deploy-android-production.yml` (android), but mobile staging bundles both in one `deploy-mobile-staging.yml`. Inconsistency in granularity.
2. **No `deploy-mobile-production.yml`** orchestrator file — unlike `deploy-all-production.yml` which orchestrates across apps.
3. **`validate-api-staging.yml` runs on PRs** targeting main, not in staging environment. Misleading name.
4. **`sync-translations.yml` targets production API** but has no env indicator in name.
5. **No explicit "staging" env** for `pr.yml` / CI checks — which is correct (CI is environment-agnostic), but inconsistent with `ci-api.yml` naming.

---

## Categorization

### Category: Code Quality & Security (CI)

| Workflow            | Purpose                                            | Priority |
| ------------------- | -------------------------------------------------- | -------- |
| `ci-commitlint.yml` | Enforce conventional commits on PR titles          | Medium   |
| `ci-pr.yml`         | Format check, tests, lint, typecheck, React Doctor | High     |
| `ci-socket.yml`     | Supply chain security scan (Socket.dev)            | High     |
| `ci-api.yml`        | Broader API validation suite on PRs                | Medium   |

### Category: Deployments

| Workflow                               | App              | Env                       | Priority |
| -------------------------------------- | ---------------- | ------------------------- | -------- |
| `deploy-admin-production.yml`          | admin            | production                | High     |
| `deploy-admin-staging.yml`             | admin            | staging                   | Medium   |
| `deploy-api-production.yml`            | api              | production                | High     |
| `deploy-api-staging.yml`               | api              | staging                   | High     |
| `deploy-mobile-android-production.yml` | mobile (android) | production                | Medium   |
| `deploy-mobile-staging.yml`            | mobile           | staging                   | Medium   |
| `deploy-mobile-web-production.yml`     | mobile (web)     | production                | Medium   |
| `deploy-all-production.yml`            | all              | production (orchestrator) | Medium   |

### Category: Admin/Maintenance

| Workflow                      | Purpose                           | Priority |
| ----------------------------- | --------------------------------- | -------- |
| `admin-expo-sync.yml`         | Weekly Expo SDK version sync + PR | Low      |
| `admin-sync-translations.yml` | Weekly DB → locale file sync + PR | Low      |

---

## Issue #229 Analysis

### Current `bun install` Occurrences

**Confirmed: 18 occurrences** across 10 workflows (exactly matching the issue count).

### `--minimum-release-age` Flag Status

- **12 of 18** occurrences use `--minimum-release-age=0`
- Comments in `pr.yml` (lines 45-47) track this: "Remove when packages are > 4 days old (~Jun 19)"
- **As of July 5**, Expo 56.x packages are ~20 days old — the flag can be safely removed from ALL occurrences
- The `bunfig.toml` has `minimumReleaseAge = 345600` (4 days), which is the real policy — in CI with `--frozen-lockfile` the `minimumReleaseAge` setting is irrelevant anyway (no new packages being resolved)

### Cache Strategy

| Item                  | Assessment                                                                         |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Cache key**         | `bun-${{ hashFiles('bun.lock') }}` — single key, all workflows share same lockfile |
| **Cache scope**       | Root `node_modules/` + `apps/*/node_modules/` + `packages/*/node_modules/`         |
| **actions/cache@v5**  | Available, supports glob patterns                                                  |
| **Estimated savings** | ~20-30s per occurrence → ~6-9min saved per full CI run                             |
| **Socket.dev**        | No cache opportunity (no bun install)                                              |

### Composite Action Design

`.github/actions/setup/action.yml` should wrap:

1. `actions/checkout@v5` — or should checkout stay in the workflow? The issue doesn't mention it, but checkout version is inconsistent (v4 vs v5), so including it in the composite action would ensure consistency. **However**, some jobs need `fetch-depth: 0` and some don't.
2. `oven-sh/setup-bun@v2`
3. `actions/cache/restore@v5` — key: `bun-${{ hashFiles('bun.lock') }}`
4. `bun install --frozen-lockfile` — only on cache miss
5. `actions/cache/save@v5` — only on cache miss

**Open question**: Should checkout be included in the composite action? If yes, how to handle `fetch-depth: 0` cases (pr.yml validate-mobile, deploy-android-production, deploy-mobile-staging, validate-api-staging)? Can be an input parameter.

---

## Recommendations

### 1. Create Composite Action (Issue #229)

Create `.github/actions/setup/action.yml` that wraps checkout + setup-bun + cache + bun install. This removes 18 occurrences of boilerplate. Include `fetch-depth` as an input parameter.

### 2. Remove `--minimum-release-age=0`

Safe to remove from all workflows. The `bunfig.toml` policy (345600s) is the long-term safeguard; CI with `--frozen-lockfile` doesn't resolve new packages.

### 3. Standardize `actions/checkout` to v5

3 workflows use v4 (`deploy-api-production.yml`, `deploy-production-manual.yml`, `validate-api-staging.yml`). The composite action handles this.

### 4. Rename Workflows for Consistency

Apply the `{category}-{app}-{env}.yml` naming convention to all 14 files. See [Naming Analysis](#naming-analysis) for the full mapping.

### 5. Fix `validate-api-staging.yml` Misclassification

Rename to `ci-api.yml` — it validates on PRs, not in staging. The "staging" label is a naming artifact.

### 6. Align Mobile Staging & Production Structure

Either:

- (A) **Split** `deploy-mobile-staging.yml` into `deploy-mobile-web-staging.yml` + `deploy-mobile-android-staging.yml` to mirror production, OR
- (B) **Merge** `deploy-web-production.yml` + `deploy-android-production.yml` into a single `deploy-mobile-production.yml` to mirror staging.

Recommend **(A)** — keep granular deployment files, add a `deploy-mobile-production.yml` orchestrator that calls both web and android production.

### 7. Keep `deploy-all-production.yml` as Cross-App Orchestrator

Rename from `deploy-production-manual.yml` — it chains web → api → android production. This is distinct from a mobile-only orchestrator.

### 8. Action Items Priority

| #   | Item                                                            | Effort                      | Impact                          | Depends On                       |
| --- | --------------------------------------------------------------- | --------------------------- | ------------------------------- | -------------------------------- |
| 1   | Create `.github/actions/setup/action.yml`                       | Medium                      | High (cache all 18 bun install) | —                                |
| 2   | Replace all 18 bun install with `uses: ./.github/actions/setup` | Medium                      | High                            | #1                               |
| 3   | Remove `--minimum-release-age=0`                                | Low                         | Low                             | —                                |
| 4   | Rename workflow files                                           | High (git mv + update refs) | Medium                          | #1 (to avoid re-editing)         |
| 5   | Fix `validate-api-staging.yml` → `ci-api.yml`                   | Low                         | Medium                          | #4                               |
| 6   | Standardize checkout to v5                                      | Low                         | Low                             | #1 (handled by composite action) |
| 7   | Split mobile production web/android                             | Medium                      | Low                             | #4                               |

---

## Files to Create/Modify

### Create

- `.github/actions/setup/action.yml` — composite action (checkout + setup-bun + cache + bun install)

### Modify (replace bun install + remove `--minimum-release-age`)

- `commitlint.yml`
- `deploy-admin-production.yml`
- `deploy-admin-staging.yml`
- `deploy-android-production.yml` (2 removals)
- `deploy-api-production.yml`
- `deploy-api-staging.yml`
- `deploy-mobile-staging.yml` (3 removals)
- `deploy-web-production.yml`
- `expo-sdk-version-sync.yml` (2 removals)
- `pr.yml` (4 removals)
- `sync-translations.yml`
- `validate-api-staging.yml`

### Rename (git mv)

- `commitlint.yml` → `ci-commitlint.yml`
- `pr.yml` → `ci-pr.yml`
- `socket.yml` → `ci-socket.yml`
- `validate-api-staging.yml` → `ci-api.yml`
- `deploy-web-production.yml` → `deploy-mobile-web-production.yml`
- `deploy-android-production.yml` → `deploy-mobile-android-production.yml`
- `deploy-production-manual.yml` → `deploy-all-production.yml`
- `expo-sdk-version-sync.yml` → `admin-expo-sync.yml`
- `sync-translations.yml` → `admin-sync-translations.yml`
