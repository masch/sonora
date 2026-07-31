# Tasks: Android ProGuard Mapping Upload

## Review Workload Forecast

| Field                   | Value     |
| ----------------------- | --------- |
| Estimated changed lines | 15–25     |
| 400-line budget risk    | Low       |
| Chained PRs recommended | No        |
| Suggested split         | single PR |
| Delivery strategy       | single-pr |
| Chain strategy          | pending   |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

## Scope

Two files to modify: `Makefile` and `.github/workflows/deploy-mobile-android-production.yml`. R8 verification is a manual one-time check with no code changes.

---

## Tasks

### Phase 1 — R8 Verification (one-time, manual)

> **Post-archive follow-ups (parent-approved, 2026-07-31):** These manual tasks cannot run in this environment and are recorded as follow-ups to complete after archive. The code implementation does not depend on them (FR-1..4 pass independently).

- [ ] Run `npx expo prebuild --platform android --clean` in `apps/mobile/` to generate the native android project. <!-- sdd-owner: implementation -->
- [ ] Inspect `apps/mobile/android/app/build.gradle` and confirm `buildTypes.release.minifyEnabled` is `true` and `proguardFiles` references default R8 rules. <!-- sdd-owner: implementation -->
- [ ] Run `cd apps/mobile/android && ./gradlew :app:assembleRelease` and verify that `apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` is generated. <!-- sdd-owner: implementation -->
- [ ] Document any R8 configuration findings. If `minifyEnabled` is not `true`, note that a separate change is needed before this pipeline will produce mapping files. <!-- sdd-owner: parent -->

### Phase 2 — Makefile Change

- [x] In `Makefile`, target `eas-build-android-release-ci-unsigned` (around line 911), append a `&& \` and a `cp` command after the existing AAB `mv` line to copy the mapping file:
      `cp android/app/build/outputs/mapping/release/mapping.txt $(if $(OUTPUT_MAPPING),$(OUTPUT_MAPPING),sonora-release-mapping.txt)`. <!-- sdd-owner: implementation -->
- [ ] Verify the Makefile change by running the target locally with explicit `OUTPUT_APK`, `OUTPUT_AAB`, and `OUTPUT_MAPPING` and confirming the mapping file is created at the expected path. <!-- sdd-owner: implementation --> <!-- post-archive follow-up (parent-approved) -->

### Phase 3 — Build Job Workflow Changes

- [x] In `.github/workflows/deploy-mobile-android-production.yml`, add `OUTPUT_MAPPING="sonora-${{ steps.tag-release.outputs.tag }}-mapping.txt"` to the `make eas-build-android-release-ci-unsigned` invocation in the `Build Android APK + AAB (Unsigned)` step. <!-- sdd-owner: implementation -->
- [x] After the `Upload Unsigned AAB Artifact` step, add a new step `Upload Android Mapping Artifact` using `actions/upload-artifact@v4` with: - `name: android-mapping` - `path: apps/mobile/sonora-*-mapping.txt` - `if-no-files-found: warn` - `retention-days: 30`. <!-- sdd-owner: implementation -->

### Phase 4 — Deploy Job Workflow Changes

- [x] In the `deploy-play-store` job, add `build-android` to the `needs` array: `needs: [sign-android, build-android]`. <!-- sdd-owner: implementation -->
- [x] Before the `Generate Tag-Based Release Notes` step, add a `Download Android Mapping Artifact` step using `actions/download-artifact@v4` with: - `name: android-mapping` - `path: apps/mobile`. <!-- sdd-owner: implementation -->
- [x] In the `Deploy AAB to Google Play Store` step, add `mappingFile: apps/mobile/sonora-${{ needs.build-android.outputs.tag_name }}-mapping.txt` to the `r0adkll/upload-google-play@v1` inputs. <!-- sdd-owner: implementation -->

### Phase 5 — Integration Verification

- [ ] Trigger a CI run via `workflow_dispatch` on the production Android workflow and confirm: - `build-android` job succeeds and produces `android-mapping` artifact with 30-day retention. - `deploy-play-store` job downloads the mapping artifact and includes `mappingFile` in the upload call. - No CI step fails if the mapping file happens to be absent (`if-no-files-found: warn` is observed). <!-- sdd-owner: implementation --> <!-- post-archive follow-up (parent-approved) -->

### Post-Apply Review

> **Post-archive follow-up (parent-approved, 2026-07-31):** The verify phase ran an independent review of both files (FR-1..4 PASS, NFR-2 resolved). An explicit bounded review transaction is recorded as a follow-up to run after merge.

- [ ] Start or reuse bounded review across the two modified files (`Makefile`, `deploy-mobile-android-production.yml`) to confirm each change matches the spec and design exactly. <!-- sdd-owner: parent -->
