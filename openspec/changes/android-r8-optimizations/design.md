# SDD Design: Android R8 Optimization and Resource Shrinking

**Change:** `android-r8-optimizations`
**Phase:** Design
**Based on:** Proposal + Spec (`openspec/changes/android-r8-optimizations/spec.md`)

---

## 1. Architectural Architecture & Mechanics

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Build Configuration Flow                       │
│                                                                        │
│   apps/mobile/app.config.ts                                            │
│   └── expo-build-properties                                            │
│       ├── enableMinifyInReleaseBuilds: true                            │
│       └── enableShrinkResourcesInReleaseBuilds: true (NEW)             │
│                            │                                           │
│                            ▼                                           │
│   apps/mobile/android/gradle.properties                                │
│   ├── android.enableMinifyInReleaseBuilds=true                         │
│   └── android.enableShrinkResourcesInReleaseBuilds=true (NEW)          │
│                            │                                           │
│                            ▼                                           │
│   apps/mobile/android/app/build.gradle (release buildType)             │
│   ├── minifyEnabled = true (reads property)                            │
│   ├── shrinkResources = true (reads property)                          │
│   └── proguardFiles:                                                   │
│       ├── BEFORE: getDefaultProguardFile("proguard-android.txt")       │
│       │           (Disables bytecode optimizations via -dontoptimize)  │
│       └── AFTER:  getDefaultProguardFile("proguard-android-optimize.txt")│
│                   (Enables R8 class merging, inlining & optimization)  │
│       └── apps/mobile/android/app/proguard-rules.pro                   │
│           ├── keep com.swmansion.reanimated.**                         │
│           └── keep com.facebook.react.turbomodule.**                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed File Modifications

### 2a. `apps/mobile/app.config.ts`

Add `enableShrinkResourcesInReleaseBuilds: true` to the `expo-build-properties` plugin configuration.

```typescript
      [
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            debugSymbolLevel: 'SYMBOL_TABLE',
          },
        },
      ],
```

### 2b. `apps/mobile/android/gradle.properties`

Define `android.enableShrinkResourcesInReleaseBuilds=true`.

```properties
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
```

### 2c. `apps/mobile/android/app/build.gradle`

In `android.buildTypes.release`:
Update `proguardFiles` to use `proguard-android-optimize.txt`.

```groovy
release {
    signingConfig signingConfigs.debug
    def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
    shrinkResources enableShrinkResources.toBoolean()
    minifyEnabled enableMinifyInReleaseBuilds
    proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
    def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
    crunchPngs enablePngCrunchInRelease.toBoolean()
}
```

### 2d. `apps/mobile/android/app/proguard-rules.pro`

Ensure baseline keep rules for React Native and Expo JNI reflection are preserved, and add common keep attributes if needed for reflection stability:

```proguard
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
```

---

## 3. Toolchain & AGP Version Rationale

- **Constraint**: Google Play Console recommends AGP 9.0+.
- **Decision**: Reject AGP 9.0 bump. Expo SDK 56 autolinking and React Native Gradle plugin (v0.85) require AGP 8.x. Issue `expo/expo#49550` documents that AGP 9 is incompatible with `expo-gradle-plugin` (Kotlin version mismatch).
- **Resolution**: Fulfill Play Console's core vitals requirement through R8 optimization and resource shrinking while staying on the supported Expo SDK 56 AGP baseline.

---

## 4. Verification Plan

1. **Gradle Dry-Run / Evaluation**:
   Run `./gradlew :app:tasks` or property verification to confirm `shrinkResources` and `minifyEnabled` evaluate to true.
2. **Local Release Build**:
   Run `make eas-build-android-release-ci-unsigned` or `./gradlew :app:assembleRelease` to verify R8 compiles without keep-rule or shrinking conflicts.
3. **Artifact Verification**:
   Verify `mapping.txt` is produced and APK/AAB is valid.
