# Security Pipeline — Implementation Tasks

## Review Workload Forecast

| Field                   | Value     |
| ----------------------- | --------- |
| Estimated changed lines | 260–300   |
| 400-line budget risk    | Low       |
| Chained PRs recommended | No        |
| Suggested split         | single PR |
| Delivery strategy       | single-pr |
| Chain strategy          | pending   |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

**Rationale**: ~260–300 changed lines across 3 new files, 4 modified package.jsons (version strings only), and one Makefile addition. Well under the 400-line threshold. The three domains (pinning, Renovate, audit) are independent in content but share a rollout dependency: pinning must be committed before Renovate can propose updates based on pinned versions.

---

## Task 1 — Create `scripts/pin-deps.ts` ✅

**Dependencies**: None

**Status**: Complete. `scripts/pin-deps.ts` created and verified.

**Description**: Create the one-time automated pinning script at `scripts/pin-deps.ts`. The script reads resolved versions from `node_modules/<package>/package.json` (after `bun install`) and replaces all range constraints (`^`, `~`, `*`) with exact pinned versions across the four target files.

**File to create**: `scripts/pin-deps.ts`

**Behavior**:

- Reads from `node_modules/<package>/package.json` version field (matches `bun.lock` resolution)
- Fallback: if `require.resolve` fails, read from workspace root `node_modules` directly
- Processes exactly 4 files (hardcoded paths):
  - `apps/api/package.json`
  - `apps/mobile/package.json`
  - `apps/admin/package.json`
  - `packages/shared/package.json`
- Skips `workspace:*` references (exempt per PIN.1)
- Skips entries that are already exact (no `^`, `~`, `*` prefix)
- Resolves 26 specific packages listed in PIN.4 / design doc

**Verification** (run after writing, before committing):

1. `bun run scripts/pin-deps.ts` exits 0
2. Regex scan confirms no `^`, `~`, `*` remain in any target file's dependency entries (excluding `workspace:*`)
3. `bun install --frozen-lockfile` exits 0 (PIN.3)
4. `git diff --name-only bun.lock` produces no output (lockfile unchanged)
5. Root `package.json` and non-target `package.json` files untouched
6. Only the 4 listed files show modifications

**Error handling**:

- Exit 1 if any file cannot be read or written
- Exit 1 if any range specifier remains after pass
- Exit 1 if `bun install --frozen-lockfile` fails post-pinning

---

## Task 2 — Add `pin-deps` target to Makefile ✅

**Dependencies**: Task 1 (target references the script)

**Status**: Complete. `.PHONY: pin-deps` added to `# Supply Chain Security` section.

**File to modify**: `Makefile`

**Changes**:

- Add a `.PHONY: pin-deps` target in the existing "# Supply Chain Security" section (near the `socket-scan` target)
- Command: `bun run scripts/pin-deps.ts`
- Dependency: `install` (via `pin-deps: install` so node_modules is guaranteed populated)
- Help text: `## Pin all workspace dependencies to exact versions from bun.lock`

**Verification**:

- `make help` shows the new target in the listing
- `make pin-deps` runs `bun run scripts/pin-deps.ts`

---

## Task 3 — Pin all dependencies ✅

**Dependencies**: Tasks 1, 2

**Status**: Complete. 26 version constraints pinned across 4 files. `bun install --frozen-lockfile` verified (no changes). Lockfile unchanged.

**Description**: Execute the pinning script to produce the actual version changes across the 4 package.json files, then verify and commit.

**Execution**:

1. Run `bun install` (ensure node_modules is current)
2. Run `bun run scripts/pin-deps.ts`
3. Verify post-conditions:
   - `bun install --frozen-lockfile` passes
   - `git diff --name-only bun.lock` is empty
   - No other files modified
4. Commit with message: `feat: pin all workspace dependencies to exact versions`

**Files modified** (26 version strings total):

| File                           | Entries                                                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/package.json`        | 12: hono, drizzle-orm, pg, @neondatabase/serverless, @hono/node-server, @cloudflare/workers-types, vitest, wrangler, drizzle-kit, @types/pg, @types/node, tsx                                               |
| `apps/mobile/package.json`     | 10: @expo-google-fonts/caveat, @react-native-firebase/analytics, @react-native-firebase/app, @react-native-firebase/crashlytics, firebase, zustand, @types/leaflet, firebase-tools, react-doctor, jest-expo |
| `apps/admin/package.json`      | 2: zustand, jest-expo                                                                                                                                                                                       |
| `packages/shared/package.json` | 2: zod, vitest                                                                                                                                                                                              |

**Verification**:

- `git diff --stat` shows exactly 4 files with version string changes
- `bun install --frozen-lockfile` exits 0
- All tests pass: `make test`

---

## Task 4 — Create `renovate.json` ✅

**Dependencies**: Task 3 (pinning must be committed before Renovate sees the repo)

**Status**: Complete. `renovate.json` at repository root with `"rangeStrategy": "pin"`, weekly schedule, dependency dashboard enabled.

**File to create**: `renovate.json`

**Configuration** (per design spec):

```jsonc
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "enabledManagers": ["bun"],
  "rangeStrategy": "pin",
  "schedule": ["before 6am on Monday"],
  "dependencyDashboard": true,
  "dependencyDashboardTitle": "Dependency Dashboard (Renovate)",
  "labels": ["dependencies"],
  "assignees": [],
  "reviewers": [],
  "automerge": false,
  "bun": {
    "fileMatch": ["(^|/)package\\.json$"],
  },
}
```

**Verification**:

- `renovate.json` exists at repository root with valid JSON syntax
- `enabledManagers` contains `"bun"` and no other managers
- `rangeStrategy` is `"pin"`
- `schedule` specifies weekly cadence (no daily)
- `dependencyDashboard` is `true`
- `automerge` is `false`

**Post-commit**: After merging, onboard the Renovate Community Cloud app on the repository.

---

## Task 5 — Create `.github/workflows/security-audit.yml` ✅

**Dependencies**: None (independent of pinning; can be created in any order)

**Status**: Complete. Workflow with schedule + workflow_dispatch, threshold checking, step summary, and optional issue creation.

**File to create**: `.github/workflows/security-audit.yml`

**Workflow specification** (per design):

| Aspect      | Value                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| Name        | `Security Audit`                                                         |
| Triggers    | `schedule: cron '0 6 * * 1'` (Monday 06:00 UTC) + `workflow_dispatch`    |
| Permissions | `contents: read`, `issues: write`                                        |
| Concurrency | Grouped by ref, cancel-in-progress                                       |
| Env         | `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` (matching existing workflows) |

**Steps**:

1. **Checkout** (`actions/checkout@v5`)
2. **Setup** (`.github/actions/setup` with `skip-if-cache-hit: 'true'`)
3. **Run bun audit** (`bun audit --format=json > audit-output.json`, `continue-on-error: true`)
4. **Parse and threshold check** (`actions/github-script@v7`):
   - Parse JSON audit output (fall back to plain text parsing if JSON fails)
   - Filter findings by severity threshold (default: `moderate`)
   - Set `should_fail` output based on findings
   - Write summary table to `$GITHUB_STEP_SUMMARY`
5. **Fail on threshold breach** (conditional: `should_fail == 'true'`)
6. **Create Issue on findings** (conditional: `workflow_dispatch` AND `create-issue: true`)

**workflow_dispatch inputs**:

- `severity-threshold`: choice (`low`, `moderate`, `high`, `critical`), default `moderate`
- `create-issue`: boolean, default `false`

**Verification**:

- Workflow file is valid YAML
- `bun audit --format=json` runs without error in CI environment
- `$GITHUB_STEP_SUMMARY` contains findings table when vulnerabilities detected
- Issue creation fires only on `workflow_dispatch` with `create_issue: true`
- Workflow passes on clean audit, fails on findings above threshold
- `actions/github-script@v7` parsing has fallback for non-JSON output

---

## Rollout Order

1. **Tasks 1 + 2 + 3** (pinning script, Makefile, execute): Pin all dependencies in one commit
2. **Task 4** (Renovate config): Add `renovate.json`, push, onboard Renovate app
3. **Task 5** (audit workflow): Add `security-audit.yml`, verify via `workflow_dispatch`

## Rollback

- `git revert` the pinning commit (restores range constraints)
- Delete `renovate.json` and disable Renovate app from repository settings
- Delete `.github/workflows/security-audit.yml`
- Close any Renovate-created PRs

## Risks

| Risk                                     | Impact                        | Mitigation                                                        |
| ---------------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| Pin conflicts with transitive peer deps  | Install fails                 | PIN.3 verification: `bun install --frozen-lockfile` after pinning |
| `bun audit --format=json` format changes | Parsing fails                 | Fallback to plain text parsing in github-script                   |
| Renovate PR storm                        | High volume of concurrent PRs | Weekly schedule + dashboard + no automerge                        |
| `workspace:*` accidentally pinned        | Build breaks                  | Explicit exclusion in script; validated by regex scan             |
