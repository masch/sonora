# SDD Spec: Android ProGuard Mapping Upload

**Change:** `android-proguard-mapping`
**Phase:** Spec
**Based on:** Proposal (`sdd/android-proguard-mapping/proposal`)

---

## 1. Functional Requirements

### FR-1: Capture Mapping.txt in Makefile

| ID     | Requirement                                                                                                                                                                  | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1.1 | The `eas-build-android-release-ci-unsigned` Makefile target SHALL copy `android/app/build/outputs/mapping/release/mapping.txt` to a named output file after Gradle finishes. | HIGH     |
| FR-1.2 | The output mapping filename SHALL be configurable via a `OUTPUT_MAPPING` variable, defaulting to `sonora-release-mapping.txt`.                                               | HIGH     |
| FR-1.3 | The `cp` command SHALL be placed after the existing `mv` commands for APK and AAB so all artifact files are available at the end of the target.                              | HIGH     |

### FR-2: Upload Mapping as CI Artifact

| ID     | Requirement                                                                                                                                              | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-2.1 | The `build-android` job SHALL upload the mapping file as a GitHub Actions artifact named `android-mapping`.                                              | HIGH     |
| FR-2.2 | The artifact SHALL use `if-no-files-found: error` so a missing mapping file fails the build fast (fail-fast contract — mapping is required for release). | MEDIUM   |
| FR-2.3 | The artifact retention SHALL be 30 days.                                                                                                                 | HIGH     |

### FR-3: Pass Mapping Through Pipeline

| ID     | Requirement                                                                                                                                     | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-3.1 | The `deploy-play-store` job SHALL add `build-android` to its `needs` array.                                                                     | HIGH     |
| FR-3.2 | The `deploy-play-store` job SHALL download the `android-mapping` artifact before the Play Console upload step.                                  | HIGH     |
| FR-3.3 | The mapping file SHALL NOT flow through `sign-android` — it does not need signing and the unsigned build's mapping is valid for the signed AAB. | HIGH     |

### FR-4: Wire mappingFile to Play Console Upload

| ID     | Requirement                                                                                                              | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-4.1 | The `r0adkll/upload-google-play@v1` step SHALL include the `mappingFile` input pointing to the downloaded mapping file.  | HIGH     |
| FR-4.2 | The mapping file path SHALL use the tag name from `needs.build-android.outputs.tag_name` to match the signed AAB naming. | HIGH     |

### FR-5: Verify R8 Configuration

| ID     | Requirement                                                                                                                                            | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-5.1 | A one-time verification SHALL confirm that `android/app/build.gradle` has `minifyEnabled true` for the `release` build type after `npx expo prebuild`. | MEDIUM   |
| FR-5.2 | A one-time verification SHALL confirm that `mapping.txt` is generated during `./gradlew :app:assembleRelease`.                                         | MEDIUM   |
| FR-5.3 | If R8 is not enabled, the fix SHALL be documented but is out of scope for this change.                                                                 | LOW      |

---

## 2. Non-Functional Requirements

| ID    | Requirement                                                                                                                                                                    | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| NFR-1 | The mapping artifact MUST use 30-day retention — long enough for the Play Console to become the permanent home, short enough to auto-clean.                                    | HIGH     |
| NFR-2 | The `deploy-play-store` job MUST NOT fail if the mapping artifact is missing (use no-op or conditional step). A missing mapping file should not block Play Console deployment. | MEDIUM   |
| NFR-3 | Zero behavioral change to the app binary — no new Gradle plugins, no custom ProGuard rules, no build config changes.                                                           | HIGH     |
| NFR-4 | The total CI pipeline time increase MUST be negligible (< 1 second for the `cp` command, < 5 seconds for artifact download/upload).                                            | HIGH     |

---

## 3. Acceptance Criteria

These are the verifiable conditions that define "done" for this change.

### AC-1: Makefile captures mapping.txt

```bash
# Run the build target with explicit output names
make eas-build-android-release-ci-unsigned \
  OUTPUT_APK="test.apk" \
  OUTPUT_AAB="test.aab" \
  OUTPUT_MAPPING="test-mapping.txt"
# Verify mapping file exists in apps/mobile/
test -f apps/mobile/test-mapping.txt
```

### AC-2: CI artifact appears in build run

After a successful `build-android` job run, the GitHub Actions run page shows an artifact named `android-mapping` with:

- 30-day retention badge
- A file matching the pattern `*-mapping.txt`

### AC-3: deploy-play-store downloads mapping

In a dry-run or actual deployment, the `deploy-play-store` job logs show:

- A download step for `android-mapping` artifact
- The file is present at `apps/mobile/sonora-<tag>-mapping.txt` before the upload step

### AC-4: Play Console receives mappingFile

After deployment, Google Play Console shows:

- A deobfuscation file associated with the released AAB
- The file details match the release version

### AC-5: R8 confirmed enabled

After running `npx expo prebuild --platform android --clean`:

- `android/app/build.gradle` has `minifyEnabled true` in the `release` block
- Running `./gradlew :app:assembleRelease` produces `android/app/build/outputs/mapping/release/mapping.txt`

---

## 4. Out of Scope (Reinforced)

| Item                                  | Reason                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| GitHub Release asset for mapping file | Decision: ❌ NO — mapping is exclusively for Play Console           |
| Staging pipeline changes              | Decision: ❌ NO — staging uses EAS cloud builds                     |
| Custom ProGuard rules                 | Decision: ❌ NO — default R8 config is sufficient                   |
| Mapping file signing                  | Decision: ❌ NO — mapping is deterministic per source + R8 config   |
| Crash reporting SDK changes           | Decision: ❌ NO — deobfuscation happens server-side in Play Console |

---

## 5. Constraints

- **Artifact store mode:** engram (primary) + openspec (file-based fallback)
- **CI system:** GitHub Actions
- **Android toolchain:** Expo SDK 56, AGP with R8 (default since AGP 3.4+)
- **Play Console upload action:** `r0adkll/upload-google-play@v1` (already in use)
- **Makefile:** GNU Make; the target uses a single `cd`-chained shell command
