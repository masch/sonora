# Tasks: Auto-increment Android versionCode on local builds

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | 60–80          |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | single-pr      |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation

- [ ] 1.1 **app.config.ts** — Add `versionCode: 1,` inside the `android` block after the `package:` line
- [ ] 1.2 **eas.json** — Change `cli.appVersionSource` from `"remote"` to `"local"`
- [ ] 1.3 **scripts/bump-version-code.sh** — Create bash script: read `app.config.ts`, regex-capture `versionCode`, increment by 1, write back. Handle first-run (insert `versionCode: 1,` after `package:`). Guard missing file and non-numeric value. Stage `app.config.ts` via `git add`.
- [ ] 1.4 **Makefile** — Add `.PHONY: bump-version-code` target calling `scripts/bump-version-code.sh`. Wire as prerequisite of `eas-build-android-preview-local`.

## Phase 2: Verification

- [ ] 2.1 **First-run** — Run `make bump-version-code` on clean tree; verify `app.config.ts` contains `versionCode: 1`
- [ ] 2.2 **Increment** — Run `make bump-version-code` again; verify `versionCode` changed to `2`
- [ ] 2.3 **EAS integration** — Run `make eas-build-android-preview-local`; verify APK versionCode via `aapt dump badging`
- [ ] 2.4 **Edge case: corrupt value** — Set `versionCode: abc` manually; verify script exits 1 with error message
