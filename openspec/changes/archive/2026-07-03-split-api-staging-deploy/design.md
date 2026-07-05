# Design: Split API Staging Deploy into Validation + Deploy Workflows

## Status

**Approved** — design is complete and ready for task planning.

## Executive Summary

Split the single `deploy-api-staging.yml` workflow into two: one for PR validation (triggered on `pull_request`, no secrets needed) and one for deployment (triggered on `push` to `main` and `workflow_dispatch`, with full secret access). This eliminates false-negative failures from Dependabot PRs where secrets are unavailable for DB migration steps, while keeping the same validation fidelity.

## Architecture

### Workflow Overview

```
┌─────────────────────────────────────────────────────────┐
│                   GitHub Actions                         │
│                                                          │
│  ┌─────────────────────┐    ┌─────────────────────────┐  │
│  │ validate-api-       │    │ deploy-api-             │  │
│  │ staging.yml         │    │ staging.yml             │  │
│  │                     │    │                         │  │
│  │ Trigger:            │    │ Trigger:                │  │
│  │   pull_request → main│   │   push → main           │  │
│  │                     │    │   workflow_dispatch      │  │
│  │ Paths: api/**       │    │                         │  │
│  │        shared/**    │    │ Paths: api/**            │  │
│  │        .github/**   │    │        shared/**         │  │
│  │        Makefile     │    │        .github/**        │  │
│  │                     │    │        Makefile          │  │
│  │ No environment      │    │                         │  │
│  │ No secrets          │    │ Environment: staging     │  │
│  │                     │    │ Secrets: DATABASE_URL    │  │
│  │ Steps:              │    │          CLOUDFLARE_...  │  │
│  │   checkout          │    │                         │  │
│  │   setup-bun         │    │ Steps:                  │  │
│  │   rm tsconfig.json  │    │   checkout (v5)          │  │
│  │   bun install       │    │   setup-bun              │  │
│  │   make api-validate │    │   rm tsconfig.json       │  │
│  │   change-type       │    │   bun install            │  │
│  │   detection         │    │   make api-validate      │  │
│  └─────────────────────┘    │   make api-db-migrate-ci │  │
│                              │   make api-db-seed-ci    │  │
│                              │   make api-deploy-staging│  │
│                              └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision                         | Choice                                             | Rationale                                                                                                |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Checkout version**             | Validate: `v4`, Deploy: `v5`                       | Deploy follows existing mobile-staging pattern (v5); validate uses simpler v4 since no history is needed |
| **Concurrency group**            | Validate: `validate-api-staging-${{ github.ref }}` | New pushes to same PR cancel in-progress runs                                                            |
|                                  | Deploy: `deploy-api-staging-${{ github.ref }}`     | New push to main cancels in-progress deploy                                                              |
| **Change-type detection**        | `git diff --name-only` against base SHA            | Simplest approach that correctly classifies deps vs source changes                                       |
| **`workflow_dispatch` behavior** | No path filtering (inherits from existing)         | Manual dispatch should bypass path filters — consistent with current behavior                            |
| **Validation environment**       | None (no `environment:` stanza)                    | No secrets needed; avoids environment protection rules                                                   |

## Detailed Workflow Specifications

### 1. `validate-api-staging.yml` (NEW)

**File**: `.github/workflows/validate-api-staging.yml`

````yaml
name: Validate API Staging

on:
  pull_request:
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'
      - '.github/workflows/**'
      - 'Makefile'
    branches:
      - main

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

concurrency:
  group: validate-api-staging-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Clean root tsconfig (prevents Wrangler warnings about missing expo/tsconfig.base)
        run: rm -f tsconfig.json
      - run: bun install --frozen-lockfile
      - run: make api-validate

      - name: Detect change type
        id: change-type
        run: |
          CHANGED_FILES=$(git diff --name-only "${{ github.event.pull_request.base.sha }}" HEAD)
          echo "### Changed files" >> "$GITHUB_STEP_SUMMARY"
          echo '```' >> "$GITHUB_STEP_SUMMARY"
          echo "$CHANGED_FILES" >> "$GITHUB_STEP_SUMMARY"
          echo '```' >> "$GITHUB_STEP_SUMMARY"

          if echo "$CHANGED_FILES" | grep -qvE '(^|/)package\.json$|bun\.lock$'; then
            echo "classification=source-code" >> "$GITHUB_OUTPUT"
            echo "**Classification**: source-code" >> "$GITHUB_STEP_SUMMARY"
          else
            echo "classification=deps-only" >> "$GITHUB_OUTPUT"
            echo "**Classification**: deps-only" >> "$GITHUB_STEP_SUMMARY"
          fi
````

### 2. `deploy-api-staging.yml` (MODIFIED)

**File**: `.github/workflows/deploy-api-staging.yml`

```yaml
name: Deploy API Staging

on:
  workflow_dispatch:
  push:
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'
      - '.github/workflows/**'
      - 'Makefile'
    branches:
      - main

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

concurrency:
  group: deploy-api-staging-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
      - name: Clean root tsconfig (prevents Wrangler warnings about missing expo/tsconfig.base)
        run: rm -f tsconfig.json
      - run: bun install --frozen-lockfile
      - run: make api-validate
      - name: Apply pending DB migrations (idempotent)
        run: make api-db-migrate-ci
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Seed default data (idempotent — upserts only)
        run: make api-db-seed-ci
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Deploy to staging Worker
        run: make api-deploy-staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Change-Type Detection Logic

The classification step in `validate-api-staging.yml` works as follows:

1. `git diff --name-only ${{ github.event.pull_request.base.sha }} HEAD` — lists every file changed in the PR (relative to the base branch).
2. `grep -qvE '(^|/)package\.json$|bun\.lock$'` — if any file does NOT match `package.json` (at any depth) or `bun.lock`, the PR contains source code changes.
3. Output `classification` set to either `source-code` or `deps-only`, written to both `GITHUB_OUTPUT` (for workflow consumption) and `GITHUB_STEP_SUMMARY` (for human readability).

**Examples**:

- `apps/api/package.json` + `bun.lock` → `deps-only`
- `apps/api/package.json` + `apps/api/src/routes.ts` → `source-code`
- `packages/shared/package.json` + `bun.lock` → `deps-only`

### Differences from Current Workflow

| Aspect                | Current (`deploy-api-staging.yml`)         | Validate (NEW)                           | Deploy (MODIFIED)                      |
| --------------------- | ------------------------------------------ | ---------------------------------------- | -------------------------------------- |
| Trigger               | `pull_request` + `workflow_dispatch`       | `pull_request` only                      | `push` + `workflow_dispatch`           |
| Checkout version      | v4                                         | v4                                       | v5                                     |
| Concurrency group     | `${{ github.workflow }}-${{ github.ref }}` | `validate-api-staging-${{ github.ref }}` | `deploy-api-staging-${{ github.ref }}` |
| Environment           | `staging`                                  | None                                     | `staging`                              |
| Secrets               | All three                                  | None                                     | All three                              |
| Migration step        | Yes                                        | No                                       | Yes                                    |
| Seed step             | Yes                                        | No                                       | Yes                                    |
| Deploy step           | Yes                                        | No                                       | Yes                                    |
| Change-type detection | No                                         | Yes                                      | No                                     |

## Affected Files

| File                                         | Operation                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `.github/workflows/validate-api-staging.yml` | **Create** — new validation workflow                                                                |
| `.github/workflows/deploy-api-staging.yml`   | **Modify** — replace `pull_request` with `push`, bump checkout to v5, update concurrency group name |

## Risks

| Risk                                                                  | Likelihood | Impact                                                                         | Mitigation                                                                                                     |
| --------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Validation workflow misses something deploy would catch               | Low        | Low (failed validation blocks PR merge; deploy won't run)                      | Both run `make api-validate` with identical deps — same checks                                                 |
| Push to main triggers deploy before CI for the merge commit completes | Low        | Low (migrations are idempotent, seeds are upserts)                             | Spec requires idempotency for both steps                                                                       |
| `workflow_dispatch` without path filter deploys stale code            | Low        | Low (manual trigger is intentional)                                            | Documented behavior — dispatch should not be path-filtered                                                     |
| `git diff` base SHA missing in shallow checkout                       | Low        | Low (default checkout v4 is full history for PR events, but v4 may be shallow) | Actions/checkout already fetches enough history for PR merge commits; if needed, `fetch-depth: 0` can be added |

## Next Steps (Recommended: Task Planning)

1. **Apply phase**: Create `validate-api-staging.yml` and modify `deploy-api-staging.yml` as specified above
2. **Verification**: Create a test PR to confirm:
   - Validation workflow runs on PR (and succeeds for deps-only)
   - Change-type detection correctly classifies deps-only vs source-code
   - Deploy workflow does NOT trigger on PR
   - Push to main (or `workflow_dispatch`) deploys fully with migrations + seed + deploy

## Design Artifacts

- **Engram**: `sdd/split-api-staging-deploy/design` (topic_key)
- **File**: `openspec/changes/split-api-staging-deploy/design.md`
