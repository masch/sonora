# SDD Spec: Android R8 Optimization and Resource Shrinking

**Change:** `android-r8-optimizations`
**Phase:** Spec
**Based on:** Proposal (`openspec/changes/android-r8-optimizations/proposal.md`)

---

## 1. Functional Requirements

### FR-1: Enable R8 Code Optimization (`proguard-android-optimize.txt`)

| ID     | Requirement                                                                                                                                                                      | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1.1 | In `apps/mobile/android/app/build.gradle`, the `release` build type SHALL reference `getDefaultProguardFile("proguard-android-optimize.txt")` instead of `proguard-android.txt`. | HIGH     |
| FR-1.2 | The R8 optimizer SHALL perform bytecode optimizations (dead code elimination, class inlining, class merging) during release builds.                                              | HIGH     |
| FR-1.3 | Generation of `mapping.txt` for Play Console crash symbolication SHALL remain functional at `android/app/build/outputs/mapping/release/mapping.txt`.                             | HIGH     |

### FR-2: Enable Resource Shrinking

| ID     | Requirement                                                                                                                                                                       | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-2.1 | `apps/mobile/app.config.ts` SHALL configure `enableShrinkResourcesInReleaseBuilds: true` under the `expo-build-properties` plugin android options.                                | HIGH     |
| FR-2.2 | `apps/mobile/android/gradle.properties` SHALL declare `android.enableShrinkResourcesInReleaseBuilds=true`.                                                                        | HIGH     |
| FR-2.3 | In `apps/mobile/android/app/build.gradle`, `shrinkResources` in the `release` build type SHALL evaluate to `true` when `android.enableShrinkResourcesInReleaseBuilds` is enabled. | HIGH     |

### FR-3: Preserve Runtime Stability & Keep Rules

| ID     | Requirement                                                                                                                                                       | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-3.1 | Existing keep rules in `apps/mobile/android/app/proguard-rules.pro` for `com.swmansion.reanimated.**` and `com.facebook.react.turbomodule.**` SHALL be preserved. | HIGH     |
| FR-3.2 | If optimization strips required dynamic reflection classes or native bindings (JNI), appropriate `-keep` rules SHALL be declared in `proguard-rules.pro`.         | HIGH     |

### FR-4: Preserve Toolchain Compatibility (AGP Management)

| ID     | Requirement                                                                                                                                                                                       | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-4.1 | The Android build toolchain SHALL remain on the version managed by Expo SDK 56 version catalog (AGP 8.x) and SHALL NOT be manually bumped to AGP 9.0 until official Expo SDK support is released. | HIGH     |

---

## 2. Non-Functional Requirements

| ID    | Requirement                                                                                                                                               | Priority |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-1 | **Bundle Size Reduction**: Final release APK/AAB size SHOULD decrease or remain flat due to removed unused resources and stripped bytecode.               | MEDIUM   |
| NFR-2 | **Zero Runtime Crash**: Release build MUST boot cleanly, load fonts, play audio via `expo-audio`, and handle navigation without `ClassNotFoundException`. | HIGH     |
| NFR-3 | **CI Build Time**: Release compilation overhead with R8 optimization and resource shrinking enabled MUST NOT exceed 20% of existing build step time.      | MEDIUM   |

---

## 3. Scenarios & Acceptance Criteria

### Scenario 1: Release Build Gradle Evaluation

- **Given** the mobile project configuration in `app.config.ts` and `android/app/build.gradle`.
- **When** Gradle evaluates the release build type properties.
- **Then** `minifyEnabled` is `true`.
- **And** `shrinkResources` is `true`.
- **And** `proguardFiles` includes `proguard-android-optimize.txt`.

### Scenario 2: Play Console Vitals Compliance

- **Given** the generated AAB bundle.
- **When** uploaded or analyzed against Play Console vitals criteria.
- **Then** code optimization is recognized as enabled.
- **And** resource shrinking is recognized as enabled.
