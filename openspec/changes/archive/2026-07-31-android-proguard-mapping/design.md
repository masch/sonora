# SDD Design: Android ProGuard Mapping Upload

**Change:** `android-proguard-mapping`
**Phase:** Design
**Based on:** Proposal + Spec (`sdd/android-proguard-mapping/spec`)

---

## 1. Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        build-android job                           │
│                                                                     │
│  make eas-build-android-release-ci-unsigned                         │
│    ├── ./gradlew :app:assembleRelease :app:bundleRelease            │
│    │     └── generates → android/app/build/outputs/mapping/         │
│    │                       release/mapping.txt                      │
│    ├── mv → sonora-<tag>-unsigned.{apk,aab}                        │
│    └── NEW: cp → sonora-<tag>-mapping.txt                          │
│                                                                     │
│  Artifact uploads:                                                  │
│    ├── android-unsigned-apk  (1d retention)                         │
│    ├── android-unsigned-aab  (1d retention)                         │
│    └── NEW: android-mapping  (30d retention) ──────────────────────┐│
└─────────────────────────────────────────────────────────────────────┘
                                                                      │
                                                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         sign-android job                            │
│  needs: build-android                                                │
│  Downloads android-unsigned-apk + android-unsigned-aab               │
│  Signs both, uploads signed artifacts (7d retention)                │
│  (No change — mapping does NOT flow through here)                    │
└──────────────────────────────────────────────────────────────────────┘
                                                                      │
                                    ┌─────────────────────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     deploy-play-store job                           │
│  needs: sign-android + NEW: build-android                           │
│                                                                     │
│  1. Download signed AAB (existing)                                  │
│  2. NEW: Download android-mapping artifact                          │
│     → apps/mobile/sonora-<tag>-mapping.txt                          │
│  3. Deploy AAB to Google Play Store                                 │
│     with mappingFile: apps/mobile/sonora-<tag>-mapping.txt          │
│                                                                     │
│  Result: Play Console stores mapping.txt associated with the AAB    │
└──────────────────────────────────────────────────────────────────────┘
```

**Key insight:** The mapping.txt is generated during the unsigned build and is deterministic for a given source + R8 config. Signing does not re-obfuscate, so the unsigned build's mapping is valid for the signed AAB. This is why mapping can skip `sign-android` and go directly to `deploy-play-store`.

---

## 2. Detailed File Changes

### 2a. Makefile

**File:** `Makefile`
**Target:** `eas-build-android-release-ci-unsigned` (around line 903)

**Current (end of target):**

```makefile
   mv android/app/build/outputs/apk/release/app-release.apk $(if $(OUTPUT_APK),$(OUTPUT_APK),sonora-release-unsigned.apk) && \
   mv android/app/build/outputs/bundle/release/app-release.aab $(if $(OUTPUT_AAB),$(OUTPUT_AAB),sonora-release-unsigned.aab)
```

**After change:**

```makefile
   mv android/app/build/outputs/apk/release/app-release.apk $(if $(OUTPUT_APK),$(OUTPUT_APK),sonora-release-unsigned.apk) && \
   mv android/app/build/outputs/bundle/release/app-release.aab $(if $(OUTPUT_AAB),$(OUTPUT_AAB),sonora-release-unsigned.aab) && \
   cp android/app/build/outputs/mapping/release/mapping.txt $(if $(OUTPUT_MAPPING),$(OUTPUT_MAPPING),sonora-release-mapping.txt)
```

**Rationale:**

- Uses the same pattern as `OUTPUT_APK` / `OUTPUT_AAB` — configurable variable with a sensible default.
- `&&` chaining ensures the target fails atomically if any command fails.
- Placed after the `mv` commands so all output files are handled in sequence.
- The path `android/app/build/outputs/mapping/release/mapping.txt` is relative to `apps/mobile/` (the Makefile's `cd apps/mobile &&` context).

### 2b. CI Workflow — `build-android` job

**File:** `.github/workflows/deploy-mobile-android-production.yml`

**Change 1:** Add `OUTPUT_MAPPING` to the `make` call in the build step.

```yaml
- name: Build Android APK + AAB (Unsigned)
  id: build-release
  env: ...
  run: |
    make eas-build-android-release-ci-unsigned \
      OUTPUT_APK="sonora-${{ steps.tag-release.outputs.tag }}-unsigned.apk" \
      OUTPUT_AAB="sonora-${{ steps.tag-release.outputs.tag }}-unsigned.aab" \
      OUTPUT_MAPPING="sonora-${{ steps.tag-release.outputs.tag }}-mapping.txt"
```

**Change 2:** Add a new step after the existing AAB upload to upload the mapping file.

```yaml
- name: Upload Unsigned AAB Artifact
  uses: actions/upload-artifact@v4
  with:
    name: android-unsigned-aab
    path: apps/mobile/sonora-*-unsigned.aab
    if-no-files-found: error
    retention-days: 1

- name: Upload Android Mapping Artifact
  uses: actions/upload-artifact@v4
  with:
    name: android-mapping
    path: apps/mobile/sonora-*-mapping.txt
    if-no-files-found: warn
    retention-days: 30
```

**Design decisions:**

- **`if-no-files-found: warn`** (not `error`) — protects against the edge case where R8 is not enabled and mapping.txt is not generated. The build shouldn't fail just because the mapping file is absent; Play Console deployment can proceed without it (as it currently does).
- **30-day retention** — the mapping file lives here only until `deploy-play-store` uploads it to Play Console. 30 days gives ample overlap with the internal testing window.

### 2c. CI Workflow — `deploy-play-store` job

**File:** `.github/workflows/deploy-mobile-android-production.yml`

**Change 1:** Add `build-android` to the `needs` array.

```yaml
deploy-play-store:
  runs-on: ubuntu-latest
  needs: [sign-android, build-android]
  environment: production
```

**Change 2:** Add a download step for the mapping artifact before the Play Console upload step.

```yaml
steps:
  - uses: actions/checkout@v5
    with:
      fetch-depth: 0
  - uses: ./.github/actions/setup
  - name: Download Android AAB Artifact
    uses: actions/download-artifact@v4
    with:
      name: android-aab
      path: apps/mobile
  - name: Download Android Mapping Artifact
    uses: actions/download-artifact@v4
    with:
      name: android-mapping
      path: apps/mobile
  - name: Generate Tag-Based Release Notes
    ...
```

**Change 3:** Add `mappingFile` input to the Play Console upload step.

```yaml
- name: Deploy AAB to Google Play Store
  uses: r0adkll/upload-google-play@v1
  with:
    serviceAccountJsonPlainText: ${{ secrets.ANDROID_PLAY_SERVICE_ACCOUNT_JSON }}
    packageName: org.masch.sonora.app
    releaseFiles: apps/mobile/sonora-${{ needs.sign-android.outputs.tag_name }}.aab
    track: ${{ inputs.play_track || 'internal' }}
    mappingFile: apps/mobile/sonora-${{ needs.build-android.outputs.tag_name }}-mapping.txt
```

**Note on tag name:** Both `needs.sign-android.outputs.tag_name` and `needs.build-android.outputs.tag_name` resolve to the same value (propagated via the `sign-android` job's output passthrough). Using `needs.build-android.outputs.tag_name` here is semantically correct since the mapping was produced by `build-android`.

---

## 3. R8 Verification (One-Time)

This is a verification-only task, not a code change.

**Steps:**

1. Run `npx expo prebuild --platform android --clean` in `apps/mobile/`
2. Inspect `apps/mobile/android/app/build.gradle` for:
   - `buildTypes.release.minifyEnabled true`
   - `buildTypes.release.proguardFiles` referencing default rules
3. Run `cd android && ./gradlew :app:assembleRelease`
4. Verify `apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` exists

**Expected result:** Expo SDK 56 generates a Gradle config with R8 enabled by default (AGP 3.4+ default). The `mapping.txt` should be generated. If not, see §6 (Risks).

---

## 4. Implementation Plan

| Step | File                    | Action                                                | Test strategy                                 |
| ---- | ----------------------- | ----------------------------------------------------- | --------------------------------------------- |
| 1    | `Makefile`              | Add `cp` + `OUTPUT_MAPPING` at end of target          | Run target locally, verify file exists        |
| 2    | `.github/workflows/...` | Add `OUTPUT_MAPPING` to build step                    | CI dry-run or tag a test build                |
| 3    | `.github/workflows/...` | Add upload-artifact step for mapping after AAB upload | Verify artifact appears in run                |
| 4    | `.github/workflows/...` | Add `build-android` to `deploy-play-store.needs`      | CI sees dependency graph update               |
| 5    | `.github/workflows/...` | Add download-artifact step for mapping                | Verify file present at deploy step            |
| 6    | `.github/workflows/...` | Add `mappingFile` to upload-google-play step          | Observability: check Play Console post-deploy |
| 7    | Local only              | Verify R8 is enabled (`minifyEnabled true`)           | Manual inspection of generated build.gradle   |

**Ordering:** Steps 1–3 can be done first (Makefile + build-android upload). Steps 4–6 depend conceptually on step 3 completing. Step 7 is independent and can be done at any time.

**Sequence:** Apply in order 1 → 2+3 → 4+5+6 → 7 (verification can run in parallel or last).

---

## 5. Rollback & Recovery

| Scenario                         | Recovery                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Mapping upload fails in CI       | `if-no-files-found: warn` prevents hard failure. Fix R8 config or path, re-deploy.                                       |
| Mapping download fails in deploy | The upload step still runs without `mappingFile` (action accepts optional input). Deploy succeeds without deobfuscation. |
| Incorrect mapping file path      | Fix path in Makefile or workflow, re-run CI.                                                                             |
| R8 not enabled                   | Fix Gradle config (out of scope for this change, would be separate change).                                              |

**Rollback PR:** Revert the two modified files. Simple, zero-data-side-effect rollback.

---

## 6. Risks & Mitigations

| Risk                                               | Likelihood                | Impact                          | Mitigation                                                                        |
| -------------------------------------------------- | ------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| R8 not enabled in generated Gradle config          | Low (Expo SDK 56 default) | Medium (no mapping.txt)         | `if-no-files-found: warn` prevents CI failure; verification task catches it early |
| mapping.txt path changes in Gradle upgrade         | Low                       | Medium (artifact not found)     | Path is standard AGP output; if it changes, update `cp` path                      |
| Tag name mismatch between build and deploy outputs | Low                       | Low (wrong mapping for release) | Both come from same tag-release action output; they are guaranteed identical      |
| mappingFile being passed to unsigned AAB           | None                      | None                            | Mapping is deterministic; Play Console pairs it with the signed AAB independently |
| 30-day retention too short                         | Low                       | Low (re-upload if needed)       | Easy to adjust if needed; currently maps to internal testing window               |

---

## 7. Contracts (Interfaces)

### Makefile Interface

```makefile
# Usage (CI):
make eas-build-android-release-ci-unsigned \
  OUTPUT_APK="sonora-<tag>-unsigned.apk" \
  OUTPUT_AAB="sonora-<tag>-unsigned.aab" \
  OUTPUT_MAPPING="sonora-<tag>-mapping.txt"

# Variables:
#   OUTPUT_MAPPING  — output mapping filename (default: sonora-release-mapping.txt)
```

### CI Artifact Interface

| Artifact Name     | Source Job      | Consumer Job        | Retention | File Pattern           |
| ----------------- | --------------- | ------------------- | --------- | ---------------------- |
| `android-mapping` | `build-android` | `deploy-play-store` | 30 days   | `sonora-*-mapping.txt` |

### Upload Action Interface

```yaml
- uses: r0adkll/upload-google-play@v1
  with:
    # ... existing inputs ...
    mappingFile: apps/mobile/sonora-<tag>-mapping.txt
    # The action accepts mappingFile as an optional input.
    # When present, it uploads the deobfuscation file alongside the AAB.
```
