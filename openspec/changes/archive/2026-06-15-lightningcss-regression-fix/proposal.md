# Proposal: Pin lightningcss to 1.30.1

## Intent

Fix the Android APK build failure during Metro eager bundling by correctly override-pinning `lightningcss` to `1.30.1` at the root `package.json` and regenerating the lockfile.

## Scope

### In Scope

- Move/add `"overrides": { "lightningcss": "1.30.1" }` to the root `package.json`.
- Remove `"overrides": { "lightningcss": "1.30.1" }` from `apps/mobile/package.json` to avoid ignored overrides at workspace levels.
- Regenerate the lockfile using `bun install --minimum-release-age=0`.

### Out of Scope

- Fixing lightningcss upstream deserialization bugs.
- Upgrading to tailwindcss versions that don't depend on lightningcss 1.32.0.

## Capabilities

### New Capabilities

None

### Modified Capabilities

- nativewind-styling: lightningcss MUST resolve to 1.30.1.

## Approach

Define `"overrides": { "lightningcss": "1.30.1" }` in the root `package.json` and run `bun install --minimum-release-age=0` to update `bun.lock`.

## Affected Areas

| Area                       | Impact   | Description                          |
| -------------------------- | -------- | ------------------------------------ |
| `package.json`             | Modified | Add global `lightningcss` override   |
| `apps/mobile/package.json` | Modified | Remove local `lightningcss` override |
| `bun.lock`                 | Modified | Regenerated package locks            |

## Risks

None. Resolves the regression by pinning to the last known working version.

## Rollback Plan

Revert changes to `package.json` and `apps/mobile/package.json`, then checkout `bun.lock` from `main`.

## Dependencies

None.

## Success Criteria

- [ ] `bun.lock` contains `1.30.1` for `lightningcss` across all packages (e.g. `@tailwindcss/node` resolves to `1.30.1`).
- [ ] `make check` succeeds locally.
