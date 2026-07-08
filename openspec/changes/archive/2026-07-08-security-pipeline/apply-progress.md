# Security Pipeline — Apply Progress

## Status

All 5 tasks implemented. Ready for verify.

## Completed Tasks

### Task 1 — Create `scripts/pin-deps.ts` ✅

- Created `scripts/pin-deps.ts` — one-time version pinning script
- Reads resolved versions from `node_modules/<package>/package.json`
- Processes 4 target files (apps/api, apps/mobile, apps/admin, packages/shared)
- Skips `workspace:*` references and already-exact versions
- Validates post-pinning with regex scan
- Handles: hono, drizzle-orm, pg, @neondatabase/serverless, @hono/node-server, @cloudflare/workers-types, vitest, wrangler, drizzle-kit, @types/pg, @types/node, tsx, @expo-google-fonts/caveat, @react-native-firebase/analytics, @react-native-firebase/app, @react-native-firebase/crashlytics, firebase, zustand, @types/leaflet, firebase-tools, react-doctor, jest-expo, zod

### Task 2 — Add `pin-deps` target to Makefile ✅

- Added `.PHONY: pin-deps` target in `# Supply Chain Security` section
- Target depends on `install`, runs `bun run scripts/pin-deps.ts`
- Help text: `Pin all workspace dependencies to exact versions from bun.lock`

### Task 3 — Pin all dependencies ✅

- Ran `bun run scripts/pin-deps.ts` — 26 version constraints pinned across 4 files
- Verified `bun install --frozen-lockfile` exits 0 (no changes)
- Verified `git diff --name-only bun.lock` is empty
- Only the 4 target files show modifications (no root package.json changes)

Pinned versions:

| File            | Package                            | Old           | New          |
| --------------- | ---------------------------------- | ------------- | ------------ |
| apps/api        | hono                               | ^4.7.5        | 4.12.27      |
| apps/api        | drizzle-orm                        | *             | 0.45.2       |
| apps/api        | pg                                 | *             | 8.22.0       |
| apps/api        | @neondatabase/serverless           | *             | 1.1.0        |
| apps/api        | @hono/node-server                  | *             | 2.0.6        |
| apps/api        | @cloudflare/workers-types          | ^4.20250204.0 | 4.20260624.1 |
| apps/api        | vitest                             | ^4.1.9        | 4.1.9        |
| apps/api        | wrangler                           | ^4.0.0        | 4.103.0      |
| apps/api        | drizzle-kit                        | *             | 0.31.10      |
| apps/api        | @types/pg                          | *             | 8.20.0       |
| apps/api        | @types/node                        | *             | 26.0.1       |
| apps/api        | tsx                                | *             | 4.22.4       |
| apps/mobile     | @expo-google-fonts/caveat          | ^0.4.2        | 0.4.2        |
| apps/mobile     | @react-native-firebase/analytics   | ^21.9.0       | 21.14.0      |
| apps/mobile     | @react-native-firebase/app         | ^21.9.0       | 21.14.0      |
| apps/mobile     | @react-native-firebase/crashlytics | ^21.9.0       | 21.14.0      |
| apps/mobile     | firebase                           | ^11.1.0       | 11.3.1       |
| apps/mobile     | zustand                            | ^5.0.14       | 5.0.14       |
| apps/mobile     | @types/leaflet                     | ^1.9.21       | 1.9.21       |
| apps/mobile     | firebase-tools                     | ^15.19.0      | 15.22.2      |
| apps/mobile     | jest-expo                          | ~56.0.5       | 56.0.5       |
| apps/mobile     | react-doctor                       | ^0.5.8        | 0.5.8        |
| apps/admin      | zustand                            | ^5.0.14       | 5.0.14       |
| apps/admin      | jest-expo                          | ~56.0.5       | 56.0.5       |
| packages/shared | zod                                | ^3.0.0        | 3.25.76      |
| packages/shared | vitest                             | ^4.1.9        | 4.1.9        |

### Task 4 — Create `renovate.json` ✅

- Created `renovate.json` at repository root
- Config: rangeStrategy=pin, enabledManagers=[bun], weekly schedule, dependencyDashboard=true, automerge=false
- JSON syntax validated

### Task 5 — Create `.github/workflows/security-audit.yml` ✅

- Created `.github/workflows/security-audit.yml`
- Triggers: schedule (Mon 06:00 UTC) + workflow_dispatch
- Permissions: contents:read, issues:write
- Env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true (matching existing workflows)
- Steps: checkout → setup → bun audit → github-script parse + threshold check → conditional fail → optional issue creation
- Default threshold: moderate
- Parsing fallback: JSON parse with text fallback

## Files Changed

| File                                          | Action                           |
| --------------------------------------------- | -------------------------------- |
| `scripts/pin-deps.ts`                         | Created                          |
| `Makefile`                                    | Modified (added pin-deps target) |
| `apps/api/package.json`                       | Modified (12 deps pinned)        |
| `apps/mobile/package.json`                    | Modified (10 deps pinned)        |
| `apps/admin/package.json`                     | Modified (2 deps pinned)         |
| `packages/shared/package.json`                | Modified (2 deps pinned)         |
| `renovate.json`                               | Created                          |
| `.github/workflows/security-audit.yml`        | Created                          |
| `openspec/changes/security-pipeline/tasks.md` | Modified (checkboxes)            |

## Test Commands Run

- `bun run scripts/pin-deps.ts` → exit 0, 26 pinned
- `bun install --frozen-lockfile` → exit 0, no changes
- `git diff --name-only bun.lock` → empty (lockfile unchanged)

## Deviations from Design

None. Implementation follows design doc exactly.

## Remaining Tasks (not applicable to apply phase)

- Commit changes (orchestrator/user responsibility)
- Onboard Renovate Community Cloud app on repository
- Test security-audit workflow via workflow_dispatch after merge

## Delivery

- Single PR (no chaining needed)
- ~260 lines changed across 8 files (4 modified, 4 created)
- Low budget risk

## Skill Resolution

- `skill_resolution`: paths-injected (via parent)
