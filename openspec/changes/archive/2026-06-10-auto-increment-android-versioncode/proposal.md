# Proposal: Auto-increment Android versionCode on local builds

## Intent

Each local APK build (`make eas-build-android-preview-local`) must get a unique, monotonically increasing `versionCode` so Firebase App Distribution builds are distinguishable. Currently `app.config.ts` has no `android.versionCode`, and `eas.json` uses `appVersionSource: "remote"` which is ignored on `--local` builds — every APK gets `versionCode: 1`.

## Scope

### In Scope

- Add `android.versionCode` to `app.config.ts` with initial value `1`
- Switch `eas.json` `appVersionSource` from `"remote"` to `"local"` so EAS reads versionCode from config
- Create `scripts/bump-version-code.sh` — read current versionCode from `app.config.ts`, increment by 1, write back
- Wire version bump into `eas-build-android-preview-local` Makefile target as a prerequisite
- Handle first-run: if `android.versionCode` is missing, initialize to `1` before incrementing

### Out of Scope

- iOS `buildNumber` auto-increment (not requested, separate concern)
- Cloud EAS builds (`eas-build-android`, `eas-build-android-preview`) — these can use `"remote"` versioning if needed later
- Firebase distribution version metadata (labels, release notes) — versionCode is enough to distinguish builds
- Multiple-platform version coordination (Android-only for now)

## Capabilities

### New Capabilities

None — this is a dev-tooling config change, no new product capability.

### Modified Capabilities

None — no spec-level behavior changes.

## Approach

1. **Seed `android.versionCode`** in `app.config.ts` as a computed value that reads from a local file or env. The script-driven approach (option B from explore) is simplest and avoids dependency on git history.

2. **Create `scripts/bump-version-code.sh`**:
   - Read `app.config.ts` as text
   - Regex-capture current `versionCode` value (or default to `0` if absent)
   - Increment by 1
   - Replace in-place with the new value
   - Commit the change to git so the next build picks it up

3. **Update `eas.json`**: Change `cli.appVersionSource` from `"remote"` to `"local"`.

4. **Update Makefile**: Add a `bump-version-code` prerequisite to `eas-build-android-preview-local`:

   ```makefile
   .PHONY: bump-version-code
   bump-version-code:
       scripts/bump-version-code.sh

   .PHONY: eas-build-android-preview-local
   eas-build-android-preview-local: eas-whoami bump-version-code
   ```

5. **Git commit before build**: The script stages `app.config.ts` so the version bump is part of the build commit. This way `git log` also traces versionCode changes.

## Affected Areas

| Area                           | Impact   | Description                                                                              |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| `app.config.ts`                | Modified | Add `android.versionCode` field (initial `1`)                                            |
| `eas.json`                     | Modified | `appVersionSource: "remote"` → `"local"`                                                 |
| `Makefile`                     | Modified | Add `bump-version-code` target; add as prerequisite to `eas-build-android-preview-local` |
| `scripts/bump-version-code.sh` | New      | Read → increment → write script                                                          |

## Risks

| Risk                                                           | Likelihood | Mitigation                                                                                                                                  |
| -------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Multiple devs building from same commit collide on versionCode | Medium     | Script commits the bump atomically — first committer wins; second gets a merge conflict on the next pull. Acceptable for a single-dev team. |
| First run: `android.versionCode` doesn't exist yet             | High       | Script defaults to `0` if not found, producing `versionCode: 1`                                                                             |
| Firebase rejects duplicate versionCode for same app ID         | Low        | Auto-increment guarantees uniqueness per local build — this is the whole point                                                              |
| `app.config.ts` formatting broken by text replacement          | Low        | Use focused regex that only touches the `versionCode` line; validate with `tsc --noEmit` before build proceeds                              |

## Rollback Plan

1. Revert the bump commit: `git revert HEAD`
2. Remove `scripts/bump-version-code.sh`
3. Revert `eas.json` to `"remote"`
4. Remove `android.versionCode` from `app.config.ts`

The change is fully reversible with no data migration.

## Dependencies

- Bash (available on any dev machine)
- `app.config.ts` must remain parseable as text (it is — no dynamic imports in config)

## Success Criteria

- [ ] `make bump-version-code` increments `android.versionCode` in `app.config.ts`
- [ ] Running `make bump-version-code` twice produces two distinct values
- [ ] `make eas-build-android-preview-local` increments versionCode before building
- [ ] Consecutive builds produce APKs with increasing versionCodes (verified via `aapt dump badging`)
- [ ] Firebase accepts both APKs (no duplicate versionCode rejection)
