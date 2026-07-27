# Spec: splash-version

## Identifiers

| Field       | Value            |
| ----------- | ---------------- |
| Change name | `splash-version` |
| Status      | implemented      |
| Dependency  | proposal         |

## Purpose

Show the app version (`1.0.3 (42)`) on the animated splash screen, injecting version name from CI (git tag semver) so it always reflects the current build, for both staging and production.

## Functional Requirements

### FR1 — Semver extraction and validation in CI (primary guard)

Both workflows must have a step that:

1. Runs **after** "Determine Tag Name" and **before** the build step.
2. Takes the tag from `steps.get-tag.outputs.tag`.
3. Extracts semver by stripping `prod-v` or `stg-v` prefix.
4. Validates non-empty and format `X.Y.Z`.
5. Sets output `version-name`.
6. Fails the job (`exit 1`) if validation fails.

**Tag format**: `prod-v1.0.X` / `stg-v1.0.X`

### FR2 — Guard in app.config.ts

1. Read `process.env.APP_VERSION_NAME`.
2. If not defined, `throw` with clear message.
3. If defined, use as `version` field in `ExpoConfig`.

### FR3 — Display in AnimatedSplashOverlay

1. Import `expo-application` and `expo-constants`.
2. Read `nativeApplicationVersion` and `nativeBuildVersion`.
3. Render text `${appVersion} (${buildNumber})` at bottom center.
4. Dynamic background color: prod `#208AEF` (blue), staging `#F59E0B` (amber).
5. Total splash duration: 2000ms.
6. Text color: white for contrast.

### FR4 — Null-safe runtime

If `nativeApplicationVersion` or `nativeBuildVersion` is null/undefined:

- Component does NOT render version text.
- No crash, no empty string, no placeholder.

### FR5 — Both workflows

Changes apply to both production and staging CI workflows.

## Non-functional Requirements

| ID   | Requirement                                                           |
| ---- | --------------------------------------------------------------------- |
| NFR1 | CI error must be explicit: include tag and extracted value in message |
| NFR2 | Zero crashes from version rendering at runtime                        |
| NFR3 | No web impact — `animated-icon.web.tsx` returns `null`                |
| NFR4 | Version persists correctly in binary — no network dependency          |
| NFR5 | Minimum delta: ~70 lines total                                        |

## Acceptance Criteria

| ID  | Criterion                                          | How to verify                                                 |
| --- | -------------------------------------------------- | ------------------------------------------------------------- |
| AC1 | CI fails if semver cannot be extracted             | Workflow run without valid tag → job fails with clear message |
| AC2 | app.config.ts fails if APP_VERSION_NAME missing    | Local build without env var → throw with message              |
| AC3 | Splash shows `1.0.3 (42)`                          | Visual inspection of splash on staging and prod               |
| AC4 | Color staging (amber) vs production (blue) correct | Build staging → amber/blue background correctly               |
| AC5 | Null-safe: no text if version unavailable          | Mock expo-application returning null → no text rendered       |
| AC6 | Splash duration ~2000ms                            | Timer measurement                                             |
| AC7 | Both workflows have version-name step              | YAML inspection                                               |
| AC8 | app.config.ts version no longer hardcoded          | Confirm reads from env var                                    |

## Data Flow

```
Git tag (prod-v1.0.12)
       ↓
[CI: Extract semver step] → "1.0.12" → output version-name
       ↓
[CI: Build step] → env APP_VERSION_NAME=1.0.12
       ↓
[app.config.ts] → reads APP_VERSION_NAME → version: "1.0.12"
       ↓
[expo-application] → nativeApplicationVersion = "1.0.12"
                      nativeBuildVersion = "12"
       ↓
[AnimatedSplashOverlay] → "1.0.12 (12)"
```

## Error Scenarios

| Scenario                              | Behavior                                                    |
| ------------------------------------- | ----------------------------------------------------------- |
| Tag doesn't exist (describe fallback) | CI guard detects `prod-v1.0.0-temp` → invalid semver → fail |
| Tag without known prefix              | Extraction yields empty string → fail                       |
| APP_VERSION_NAME not set in CI        | Guard in app.config.ts → throw                              |
| Local build without CI                | Developer must set APP_VERSION_NAME or fail                 |
| Runtime null version                  | No text rendered (no crash)                                 |

## Out of Scope

- Settings screen version display, i18n, iOS CI, web splash
