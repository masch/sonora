# Google Play Publishing — Technical Design

## 1. Architecture Overview

```
Production Tag Push (human-triggered or scheduled)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  deploy-all-production.yml                    │
│  check-changes → tag-release → deploy-web → deploy-api →    │
│                                    deploy-android (call)     │
└──────────────────────────────────────────────────────────────┘
                          │
                      ▼ (secrets: inherit)
┌──────────────────────────────────────────────────────────────┐
│            deploy-mobile-android-production.yml               │
│                                                              │
│  ┌───────────── build-android ──────────────────────────┐   │
│  │ 1. Setup (checkout, setup, Java SDK)                 │   │
│  │ 2. Write google-services.json from secret             │   │
│  │ 3. Calculate version code from tag count             │   │
│  │ 4. Build unsigned APK (preview profile — Firebase)   │   │
│  │ 5. Write keystore from KEYSTORE_BASE64 (NEW)         │   │
│  │ 6. Build signed AAB (aab profile — Play Store) (NEW) │   │
│  │ 7. Upload APK artifact (unchanged)                   │   │
│  │ 8. Upload AAB artifact (NEW)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌───────── deploy-firebase ──────────────────────────┐     │
│  │ 1. Download APK artifact                           │     │
│  │ 2. Generate release notes                          │     │
│  │ 3. Write Firebase SA key                           │     │
│  │ 4. Distribute APK to Firebase (unchanged)          │     │
│  │ 5. Upload APK to GitHub Release (unchanged)        │     │
│  └────────────────────────────────────────────────────┘     │
│                          │                                   │
│  ┌────── submit-play-store (NEW, depends on build) ───┐    │
│  │ 1. Download AAB artifact                           │     │
│  │ 2. Write Google Play SA key from secret            │     │
│  │ 3. Submit AAB to Play Console via EAS Submit       │     │
│  │ 4. Continue on failure (warn only)                 │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────┐    ┌──────────────┐
│ Firebase    │    │ Play Console │
│ App Dist.   │    │ Internal     │
│ sonora-team │    │ Testing      │
│ (APK)       │    │ (draft AAB)  │
└─────────────┘    └──────┬───────┘
                          │ human promotes
                          ▼
                   ┌──────────────┐
                   │ Production   │
                   │ (Play UI)    │
                   └──────────────┘
```

### Key Design Principles

1. **Production-only**: Play Store publishing is exclusive to the production workflow. Staging is completely unaffected.
2. **Fail-soft on submit**: A submission failure does NOT cascade — Firebase distribution and GitHub Release continue. The AAB artifact remains available for manual upload.
3. **Same versionCode, same binary intent**: Both the unsigned APK (for Firebase) and the signed AAB (for Play Store) use the same versionCode calculated from `git tag -l "prod-v*" | wc -l`.
4. **Two separate builds, not one**: We build APK and AAB as separate EAS Build invocations. This avoids bundletool complexity, preserves the existing build pipeline unchanged, and keeps both pipelines independently debuggable. The versionCode guarantee ensures both artifacts correspond to the same release.

---

## 2. Component Design

### 2.1 eas.json Profiles

#### New `build.aab` Profile

```json
"aab": {
  "android": {
    "buildType": "app-bundle",
    "credentials": {
      "keystore": {
        "path": "./sonora-production-keystore.jks",
        "password": "${KEYSTORE_PASSWORD}",
        "keyAlias": "${KEY_ALIAS}",
        "keyPassword": "${KEY_PASSWORD}"
      }
    }
  },
  "env": {
    "EAS_BUILD_NO_EXPO_GO_WARNING": "1"
  }
}
```

Design notes:

- **`buildType: "app-bundle"`**: Tells EAS Build to produce an `.aab` file. Required for Google Play (all new apps since August 2021).
- **`credentials.keystore`**: Inline keystore config for local EAS builds. Environment variables (`${KEYSTORE_PASSWORD}`, etc.) are interpolated by EAS CLI at build time, not by GitHub Actions.
- **No `distribution: "internal"`**: This profile is for Play Store distribution, not sideloading. Play Store builds don't set `distribution`.
- **No `env.EXPO_PUBLIC_*`**: Firebase runtime env vars are already injected at the workflow level. The `aab` profile doesn't need duplicate env config.

#### New `submit.production` Profile

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-play-sa-key.json",
      "track": "internal"
    }
  }
}
```

Design notes:

- **`serviceAccountKeyPath`**: Points to a file on disk, not inline JSON. Same pattern as Firebase (`firebase-sa-key.json`).
- **`track: "internal"`**: Targets the Internal Testing track in Play Console. This is the only track that accepts AAB uploads without a live listing review. Human promotes from Internal → Closed → Production via Play Console UI.

### 2.2 Makefile Targets

#### `eas-build-android-aab-ci` — Build signed AAB in CI

```makefile
.PHONY: eas-build-android-aab-ci
eas-build-android-aab-ci: eas-whoami ## Build signed AAB for Google Play in CI (requires KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD from env)
 cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile aab --local --output="$(OUTPUT_AAB)"
```

- Mirrors the existing `eas-build-android-preview-ci` pattern: same structure, `--local` flag, `OUTPUT_*` variable.
- Keystore must already be written to `apps/mobile/sonora-production-keystore.jks` before this target runs.

#### `eas-submit-android` — Submit AAB to Google Play

```makefile
.PHONY: eas-submit-android
eas-submit-android: eas-whoami ## Submit AAB to Google Play (requires ANDROID_SERVICE_ACCOUNT_JSON written to disk)
 cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) submit -p android --profile production
```

- No `--local` flag; `eas submit` runs locally by default.
- References `submit.production` in eas.json for SA key path and track.
- AAB must exist in the project directory before running this target.

### 2.3 GitHub Actions Workflow Design

#### Key Workflow Decisions

| Decision                                        | Rationale                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Separate `submit-play-store` job**            | Isolation from `deploy-firebase`. If submit fails, Firebase is unaffected.                     |
| **`continue-on-error: true`** on submit         | Prevents submission failure from blocking `deploy-all-production.yml` orchestration.           |
| **`if: always() && build.result == 'success'`** | Submit runs only when build succeeds, even if `deploy-firebase` fails.                         |
| **Keystore written in the build job**           | Secrets stay scoped to the `production` environment.                                           |
| **SA key written in the submit job**            | Scoped to submit-only job. SA key never exists in build or Firebase jobs.                      |
| **APK still uses `preview` profile (unsigned)** | Zero changes to existing Firebase pipeline. Unsigned APKs work with Firebase App Distribution. |

#### Changes to `deploy-mobile-android-production.yml`

**In `build-android` job:**

1. Add `aab_path` to job outputs
2. New step: "Write production keystore" (after APK build, before AAB build)
3. New step: "Build Android AAB" (after keystore write)
4. New step: "Upload Android AAB Artifact" (after existing APK upload)

**New `submit-play-store` job:**

```yaml
submit-play-store:
  runs-on: ubuntu-latest
  needs: build-android
  environment: production
  if: always() && needs.build-android.result == 'success'
  continue-on-error: true
  steps:
    - uses: actions/checkout@v5
      with: { fetch-depth: 0 }
    - uses: ./.github/actions/setup
    - uses: actions/setup-node@v4
      with: { node-version: '22.23.1' }
    - name: Download Android AAB Artifact
      uses: actions/download-artifact@v4
      with: { name: android-aab, path: apps/mobile }
    - name: Write Google Play service account key
      env: { ANDROID_SERVICE_ACCOUNT_JSON: ${{ secrets.ANDROID_SERVICE_ACCOUNT_JSON }} }
      run: |
        echo "$ANDROID_SERVICE_ACCOUNT_JSON" > apps/mobile/google-play-sa-key.json
    - name: Submit to Google Play
      env:
        EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
        EAS_NO_INTERACTIVE: '1'
      run: |
        make eas-submit-android
```

### 2.4 Secrets Management

```
GitHub Secrets (production environment)
         │
         ▼
┌─────────────────────┐    ┌──────────────────────────┐
│ Build Android Job   │    │ Submit Play Store Job    │
│                     │    │                          │
│ KEYSTORE_BASE64     │    │ ANDROID_SERVICE_         │
│   → writes .jks     │    │ ACCOUNT_JSON             │
│ KEYSTORE_PASSWORD   │    │   → writes .json         │
│ KEY_ALIAS           │    │                          │
│ KEY_PASSWORD        │    │ EXPO_TOKEN               │
│                     │    │ (for EAS auth)           │
│ EXPO_TOKEN          │    │                          │
│ (for EAS auth)      │    │                          │
└─────────────────────┘    └──────────────────────────┘
```

**Why not EAS-managed credentials?**: Sonora uses EAS Build in local mode (no EAS cloud). EAS-managed credentials are cloud-only. We inject credentials manually, exactly as Firebase SA is already injected.

---

## 3. Data Flow

### End-to-end: Tag Push → Play Console Draft

```
1. Human triggers production workflow (or scheduled trigger)
       │
2. deploy-all-production.yml runs
   ├── check-changes
   ├── tag-release (create prod-v{x.y.z} tag)
   ├── deploy-web
   ├── deploy-api
   └── deploy-android → calls deploy-mobile-android-production.yml
       │
3. deploy-mobile-android-production.yml
   ├── build-android:
   │   ├── Setup (checkout, Java 17)
   │   ├── Write google-services.json
   │   ├── Calculate versionCode (prod-v* tag count)
   │   ├── [Existing] Build unsigned APK → sonora-{tag}.apk
   │   ├── [NEW] Write keystore → sonora-production-keystore.jks
   │   ├── [NEW] Build signed AAB → sonora-{tag}.aab
   │   ├── Upload APK artifact
   │   └── Upload AAB artifact
   │
   ├── deploy-firebase (needs build-android):
   │   ├── Download APK
   │   ├── Write Firebase SA key
   │   ├── Distribute APK → Firebase App Distribution (sonora-team)
   │   └── Upload APK → GitHub Release
   │
   └── submit-play-store (needs build-android):
       ├── Download AAB
       ├── Write Google Play SA key
       └── EAS Submit → Google Play Console Internal Testing (draft)
```

### Version Code Flow

```
git tag -l "prod-v*" | wc -l  →  APP_VERSION_CODE env var
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                      Preview APK Build        AAB Build
                      versionCode = N         versionCode = N
```

---

## 4. Signing Design

### How Keystore Works with EAS Build Local

1. **File location**: `apps/mobile/sonora-production-keystore.jks` (relative to repo root). Written by CI before AAB build.
2. **eas.json reference**: `credentials.keystore.path = "./sonora-production-keystore.jks"` — relative to `apps/mobile/` (EAS Build's working directory).
3. **Resolution match**: Workflow writes to `apps/mobile/sonora-production-keystore.jks`. EAS Build (running from `apps/mobile/`) looks at `./sonora-production-keystore.jks`. Both resolve to the same absolute path on the runner.
4. **EAS CLI reads**: `eas build -p android --profile aab --local` reads the profile, interpolates `${KEYSTORE_PASSWORD}`, `${KEY_ALIAS}`, `${KEY_PASSWORD}` from env, finds the keystore at the relative path, and passes credentials to the Android build toolchain.
5. **Cleanup**: Runner auto-cleans workspace on job completion.

### Signing Parameters

| Parameter          | Value                       |
| ------------------ | --------------------------- |
| Keystore type      | JKS                         |
| Key algorithm      | RSA, 2048 bits              |
| Signature algo     | SHA256withRSA               |
| Validity           | 10,000 days                 |
| APK Signing Scheme | v1 + v2 (default)           |
| AAB Signing        | v2 (required by Play Store) |

---

## 5. Submission Flow

### EAS Submit → Google Play API

```
  make eas-submit-android
    └── bunx eas-cli submit -p android --profile production

  1. Reads eas.json → submit.production
  2. Reads serviceAccountKeyPath → google-play-sa-key.json
  3. Authenticates via service account JSON (no interactive login)
  4. Finds the AAB artifact in the project directory
  5. Calls Google Play Publishing API:
     POST /androidpublisher/v3/applications/{pkg}/edits/{editId}/bundles
  6. Commits the edit (track: internal)

  Result: AAB appears as draft in Play Console
  → Internal Testing → Releases
```

### What Happens in Play Console

1. **Edit created**: EAS Submit creates a new edit in Play Console
2. **Bundle uploaded**: The AAB is uploaded as a new release
3. **Track assigned**: The release is added to the `internal` track
4. **Edit committed**: The changes are committed (draft)
5. **Status**: "Draft" in Internal Testing → Releases
6. **No automatic rollout**: Human must distribute or promote via Play Console UI

### Auth Note

EAS Submit requires BOTH `EXPO_TOKEN` (for EAS CLI auth to Expo's API) AND the Google Play service account (for Play Console upload). `EXPO_TOKEN` is already configured.

---

## 6. Error Handling

### Submission Failure Scenarios

| Scenario                    | Symptom         | Behavior                         | Recovery                                    |
| --------------------------- | --------------- | -------------------------------- | ------------------------------------------- |
| Service account missing     | File not found  | EAS Submit fails                 | Check secret, workflow write step           |
| SA permissions wrong        | 403 Forbidden   | EAS Submit fails                 | Verify Release Manager role in Play Console |
| App listing incomplete      | 400 Bad Request | EAS Submit fails                 | Complete Play Console listing               |
| Version code already exists | 409 Conflict    | EAS Submit fails                 | New tag = new versionCount                  |
| Keystore missing/wrong      | Build fails     | AAB not produced, submit skipped | Check keystore write step                   |
| Network error               | Timeout         | EAS Submit fails                 | Retry manually                              |
| Play API quota exceeded     | 429             | EAS Submit fails                 | Wait and retry                              |

### Workflow Behavior on Failure

```
build-android fails?
  → deploy-firebase: SKIPPED
  → submit-play-store: SKIPPED
  Result: Workflow fails. No distribution.

build-android succeeds, submit-play-store fails?
  → deploy-firebase: SUCCEEDS (independent job)
  → submit-play-store: FAILED (continue-on-error: true)
  Result: Workflow succeeds. Firebase distributed. AAB available as artifact.

deploy-firebase fails?
  → submit-play-store: STILL RUNS (if: always() && build succeeded)
  Result: Partial success. Play Store gets the AAB.
```

### AAB Retrieval After Failed Submission

1. Go to GitHub Actions → Workflow run → `build-android` job
2. Download `android-aab` artifact
3. Upload to Play Console manually via Play Console UI

---

## 7. Security Considerations

### Threat Model

| Threat                   | Vector                      | Impact                | Mitigation                                                |
| ------------------------ | --------------------------- | --------------------- | --------------------------------------------------------- |
| Keystore leaked          | CI logs, compromised runner | Malicious app updates | Written from secret, never logged, ephemeral runner       |
| SA key leaked            | CI logs, compromised runner | Bad releases uploaded | SA key in submit job only, never logged, ephemeral runner |
| EXPO_TOKEN compromised   | CI logs, leaked secret      | Impersonate CI        | Already scoped, env protection rules                      |
| MITM on Play API         | Network                     | Upload intercepted    | HTTPS (enforced by Google Play API)                       |
| Secret in build artifact | AAB hardcodes secrets       | Secrets in binary     | Runtime env vars, not hardcoded                           |

### Defense in Depth

1. **Environment-scoped secrets**: All new secrets in `production` environment only.
2. **Job isolation**: Keystore secrets in `build-android` job. SA key in `submit-play-store` job. No single job has both.
3. **Ephemeral runners**: Written files destroyed after job completion.
4. **No secret exposure in logs**: GitHub Actions masks secrets by default.
5. **.gitignore**: `*.jks` already covered. `google-play-sa-key.json` should be added.

---

## 8. Deployment Design (Two-Phase Rollout)

### Phase 1: Signing + AAB (No Play Console Required)

**Goal**: CI builds signed AABs alongside existing APKs. Verifiable immediately.

**Changes**:

- eas.json: Add `build.aab` profile
- Makefile: Add `eas-build-android-aab-ci` target
- Workflow: Add keystore write + AAB build + AAB artifact upload
- GitHub secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

**Verification**:

1. Trigger production workflow manually
2. Confirm `android-aab` artifact appears
3. Download and verify: `jarsigner -verify -certs sonora-*.aab`
4. Confirm staging is unaffected (no AAB, no keystore steps)

**Rollback**: Revert eas.json, Makefile, workflow changes. Remove secrets.

### Phase 2: Play Store Submission (Needs Play Console)

**Goal**: CI submits signed AAB to Play Console as draft Internal Testing release.

**Dependencies**:

- Google Play Developer account ($25)
- App listing created in Play Console (name, description, screenshots)
- Service account with Release Manager permission
- Internal Testing track configured

**Changes**:

- eas.json: Add `submit.production` profile
- Makefile: Add `eas-submit-android` target
- Workflow: Add `submit-play-store` job
- GitHub secrets: `ANDROID_SERVICE_ACCOUNT_JSON`
- New doc: `docs/play-store-setup.md`

**Verification**:

1. Complete Play Console setup
2. Trigger production workflow
3. Confirm AAB in Play Console → Internal Testing → Releases as draft
4. Service account validation: `gcloud auth activate-service-account --key-file=...` succeeds
5. Submission failure does not block Firebase (test by breaking SA key)

**Rollback**: Revert submit profile, submit job, service account secret. AAB build and Firebase continue independently.

### Phase Ordering

```
Phase 1: Build AAB ─── independent, testable NOW
   │
   └── Phase 2: Submit AAB ─── depends on Play Console setup
       │
       └── Future: Automate promotion ─── explicitly OUT of scope
```

Phase 2 dependencies (Play Developer account, app listing, service account) are parallelizable with Phase 1 development.

---

## Decision Log

| Decision                | Choice                             | Alternative                         | Rationale                                                      |
| ----------------------- | ---------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Play Store artifact     | AAB only                           | APK (still accepted)                | Google requires AAB for new apps since Aug 2021                |
| Firebase APK source     | Separate unsigned build            | Extract APK from AAB via bundletool | Simpler, preserves existing pipeline, no bundletool dependency |
| CI build order          | Sequential (APK then AAB)          | Parallel jobs                       | Avoid gradle daemon conflicts; ~5 min added to ~12 min build   |
| Keystore location in CI | Repo-local `apps/mobile/`          | Global `~/.android/`                | Simpler path resolution, auto-cleaned by runner                |
| Play Store submit track | `internal` (Internal Testing)      | `closed`, `production`              | Accepts uploads immediately without live listing review        |
| Submit failure handling | `continue-on-error: true`          | Fail the workflow                   | Firebase is independent; should not be blocked by Play issues  |
| SA auth method          | File-based `serviceAccountKeyPath` | Inline JSON env var                 | Same pattern as Firebase; EAS CLI reads file at runtime        |
| Submit job dependency   | `needs: build-android` only        | Chain after deploy-firebase         | Can run parallel to Firebase; both consume different artifacts |
