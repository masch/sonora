# SDD Proposal: Android R8 Optimization and Resource Shrinking

**Change:** `android-r8-optimizations`
**Created:** 2026-09-22
**Author:** Gentle AI / SDD
**Status:** Draft

---

## 1. Problem Statement

Google Play Console reported optimization vitals warnings for the Sonora Android release builds:

1. **"No está habilitada la optimización"**:
   - Cause: `apps/mobile/android/app/build.gradle` uses `getDefaultProguardFile("proguard-android.txt")`, which explicitly includes `-dontoptimize`.
   - Effect: R8 runs dead-code stripping and obfuscation, but skips bytecode optimizations (inlining, class merging, peer elimination).
2. **"No está habilitada la reducción de recursos"**:
   - Cause: `apps/mobile/app.config.ts` configures `enableMinifyInReleaseBuilds: true` via `expo-build-properties`, but omits `enableShrinkResourcesInReleaseBuilds: true`. `android/app/build.gradle` defaults `shrinkResources` to `false`.
   - Effect: Unused XML drawables, layouts, and third-party library assets remain packaged inside the final Android App Bundle (`.aab`).
3. **"Actualiza el complemento de Android para Gradle a la versión 9.0 o posterior"**:
   - Cause: Google Play Console vitals recommend the latest Android Gradle Plugin (AGP 9.0+).
   - Constraint: Sonora runs on Expo SDK 56 and React Native 0.85. The Expo autolinking and React Native Gradle plugin ecosystem officially pins and validates against AGP 8.x. Forcing AGP 9.0 prematurely risks breaking build toolchain compatibility.

---

## 2. Technical Findings & Proposed Solution

### 2a. Enable R8 Code Optimization (`proguard-android-optimize.txt`)

- Switch default ProGuard configuration from `proguard-android.txt` (which contains `-dontoptimize`) to `proguard-android-optimize.txt`.
- In an Expo prebuild environment, verify if `expo-build-properties` or custom config plugin can inject `proguard-android-optimize.txt` or configure it cleanly.

### 2b. Enable Resource Shrinking

- Configure `enableShrinkResourcesInReleaseBuilds: true` in `apps/mobile/app.config.ts` under `expo-build-properties` android plugin options.
- When prebuild runs, this generates `android.enableShrinkResourcesInReleaseBuilds=true` in `gradle.properties`, flipping `shrinkResources` to `true` in `build.gradle`.

### 2c. Evaluate AGP 9.0 Compatibility

- Document the incompatibility/risk matrix of AGP 9.0 against Expo SDK 56 and React Native 0.85.
- Keep AGP on the managed Expo SDK 56 catalog version to ensure build stability and avoid breaking CI/EAS workflows.

---

## 3. Risks & Verification Strategy

- **Reflection & JNI breakage**: Aggressive optimization or resource shrinking can prune dynamically referenced classes or resources. Ensure ProGuard keep rules for Reanimated, TurboModules, Expo Modules, and Firebase Crashlytics remain intact.
- **Local & CI Build verification**: Run release assembly locally or via CI to verify mapping generation, bundle size delta, and runtime stability without crashes on start.
