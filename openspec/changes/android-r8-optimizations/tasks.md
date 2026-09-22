# Tasks: Android R8 Optimization and Resource Shrinking

## Review Workload Forecast

| Field                   | Value     |
| ----------------------- | --------- |
| Estimated changed lines | 10–20     |
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

- `apps/mobile/app.config.ts`: Enable resource shrinking in `expo-build-properties`.
- `apps/mobile/android/gradle.properties`: Add `android.enableShrinkResourcesInReleaseBuilds=true`.
- `apps/mobile/android/app/build.gradle`: Switch ProGuard base to `proguard-android-optimize.txt`.
- `apps/mobile/android/app/proguard-rules.pro`: Ensure required keep attributes for reflection/annotations.

---

## Tasks

### Phase 1 — Configuration Updates

- [x] In `apps/mobile/app.config.ts`, add `enableShrinkResourcesInReleaseBuilds: true` under `expo-build-properties` android plugin options. <!-- sdd-owner: implementation -->
- [x] In `apps/mobile/android/gradle.properties`, add `android.enableShrinkResourcesInReleaseBuilds=true`. <!-- sdd-owner: implementation -->

### Phase 2 — ProGuard / R8 Optimization Activation

- [x] In `apps/mobile/android/app/build.gradle`, replace `getDefaultProguardFile("proguard-android.txt")` with `getDefaultProguardFile("proguard-android-optimize.txt")` in the `release` build type (and via `withR8Optimization` in `app.config.ts` for prebuilds). <!-- sdd-owner: implementation -->
- [x] In `apps/mobile/android/app/proguard-rules.pro`, ensure baseline keep attributes (`*Annotation*`, `Signature`, `InnerClasses`) are preserved to prevent reflection stripping (and via `extraProguardRules` in `app.config.ts`). <!-- sdd-owner: implementation -->

### Phase 3 — Verification & Validation

- [x] Run `make validate` (or `bun run typecheck` + `bun run lint`) to ensure repository integrity. Passed with code 0. <!-- sdd-owner: implementation -->
- [x] Verify Gradle configuration evaluation in `apps/mobile/android` if Gradle toolchain is available or verify static AST/properties matching. Verified via `npx expo config --type public` and `make validate`. <!-- sdd-owner: implementation -->
