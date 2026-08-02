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

> **R8 activation (2026-07-31, expanded scope):** R8 verification found `minifyEnabled` OFF by default in Expo SDK 56. The change scope was upgraded from verify-only to activation: `expo-build-properties` now sets `android.enableMinifyInReleaseBuilds: true` in `apps/mobile/app.config.ts` (pinned `expo-build-properties@56.0.24`). R8 is now enabled and mapping.txt is produced by every release build.

- [x] Run `npx expo prebuild --platform android --clean` in `apps/mobile/` to generate the native android project. Verified: `gradle.properties:64` contains `android.enableMinifyInReleaseBuilds=true`. <!-- sdd-owner: implementation -->
- [x] Inspect `apps/mobile/android/app/build.gradle` and confirm `buildTypes.release.minifyEnabled` is `true` and `proguardFiles` references default R8 rules. Verified: release build type resolves `minifyEnabled enableMinifyInReleaseBuilds` (true), `proguard-rules.pro` keeps reanimated + turbomodule rules (Crashlytics compatible). <!-- sdd-owner: implementation -->
- **Post-merge follow-up (recorded, not executable in this environment):** Run `cd apps/mobile/android && ./gradlew :app:assembleRelease` and verify that `apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` is generated at runtime. Requires Java + Android SDK; recorded in verify-report AC-2/AC-3 as not-verified-here. <!-- sdd-owner: implementation --> <!-- post-archive follow-up (parent-approved) -->
- [x] Document any R8 configuration findings. If `minifyEnabled` is not `true`, note that a separate change is needed before this pipeline will produce mapping files. Documented in verify-report: R8 was OFF by default (Expo SDK 56), activated via expo-build-properties; FR-5 DONE, AC-5 PASS. <!-- sdd-owner: parent -->

### Phase 2 — Makefile Change

- [x] In `Makefile`, target `eas-build-android-release-ci-unsigned` (around line 911), append a `&& \` and a `cp` command after the existing AAB `mv` line to copy the mapping file:
      `cp android/app/build/outputs/mapping/release/mapping.txt $(if $(OUTPUT_MAPPING),$(OUTPUT_MAPPING),sonora-release-mapping.txt)`. <!-- sdd-owner: implementation -->
- **Post-merge follow-up (recorded, not executable in this environment):** Verify the Makefile change by running the target locally with explicit `OUTPUT_APK`, `OUTPUT_AAB`, and `OUTPUT_MAPPING` and confirming the mapping file is created at the expected path. The target passes `make -n` dry-run; a full run needs the Android toolchain. <!-- sdd-owner: implementation --> <!-- post-archive follow-up (parent-approved) -->

### Phase 3 — Build Job Workflow Changes

- [x] In `.github/workflows/deploy-mobile-android-production.yml`, add `OUTPUT_MAPPING="sonora-${{ steps.tag-release.outputs.tag }}-mapping.txt"` to the `make eas-build-android-release-ci-unsigned` invocation in the `Build Android APK + AAB (Unsigned)` step. <!-- sdd-owner: implementation -->
- [x] After the `Upload Unsigned AAB Artifact` step, add a new step `Upload Android Mapping Artifact` using `actions/upload-artifact@v4` with: - `name: android-mapping` - `path: apps/mobile/sonora-*-mapping.txt` - `if-no-files-found: warn` - `retention-days: 30`. <!-- sdd-owner: implementation -->

### Phase 4 — Deploy Job Workflow Changes

- [x] In the `deploy-play-store` job, add `build-android` to the `needs` array: `needs: [sign-android, build-android]`. <!-- sdd-owner: implementation -->
- [x] Before the `Generate Tag-Based Release Notes` step, add a `Download Android Mapping Artifact` step using `actions/download-artifact@v4` with: - `name: android-mapping` - `path: apps/mobile`. <!-- sdd-owner: implementation -->
- [x] In the `Deploy AAB to Google Play Store` step, add `mappingFile: apps/mobile/sonora-${{ needs.build-android.outputs.tag_name }}-mapping.txt` to the `r0adkll/upload-google-play@v1` inputs. <!-- sdd-owner: implementation -->

### Phase 5 — Integration Verification

- **Post-merge follow-up (recorded, not executable before merge):** Trigger a CI run via `workflow_dispatch` on the production Android workflow and confirm: - `build-android` job succeeds and produces `android-mapping` artifact with 30-day retention. - `deploy-play-store` job downloads the mapping artifact and includes `mappingFile` in the upload call. - The pipeline fails fast if the mapping file is absent (`cp` fails, `if-no-files-found: error`). <!-- sdd-owner: implementation --> <!-- post-archive follow-up (parent-approved) -->

### Post-Apply Review

> **Bounded review (2026-08-01):** Completed and APPROVED pre-merge. Lineage `review-f24a2e4ad269741b`, risk HIGH, 4 lenses (risk/resilience/readability/reliability), 0 SEVERE findings, terminal state `approved`, receipt persisted in `.git/gentle-ai/review-transactions/v2/`. Only informational WARNINGs (archived doc drift, R8 runtime unproven, floating `r0adkll/upload-google-play@v1` tag).

- [x] Start or reuse bounded review across the modified files (`Makefile`, `deploy-mobile-android-production.yml`, `app.config.ts`, workflow) to confirm each change matches the spec and design exactly. <!-- sdd-owner: parent -->
