# SDD Proposal: Google Play Store Publishing for Sonora

## Status: Draft Proposal

**Change**: `google-play-publishing`
**Project**: Sonora (apps/mobile — Expo SDK 56, managed workflow)
**Date**: 2026-07-10

---

## 1. Problem Statement

Sonora's CI/CD pipeline builds Android APKs and distributes them via Firebase App Distribution. This works for internal testing but cannot serve users through the Google Play Store — the primary Android distribution channel.

**Current pipeline ends at Firebase**: staging APKs go to dev-team, production APKs go to sonora-team. There's no way to get the app into users' hands through the Play Store without manual, out-of-band steps.

**Missing capabilities**:

- No AAB artifact (Play Store requires Android App Bundle since August 2021)
- No APK/AAB signing in CI (unsigned APKs are fine for Firebase, rejected by Play Store)
- No Play Store upload/submission mechanism
- No Google Play API credentials configured

---

## 2. Proposed Solution

Add Google Play Store publishing to the existing GitHub Actions CI pipeline with clear separation between staging (Firebase-only) and production (Firebase + Play Store).

### High-Level Flow

```
Production tag push
        │
        ▼
  ┌─────────────────┐
  │ Build AAB       │  ← New: signed Android App Bundle
  │ (eas.json: aab) │
  └────────┬────────┘
           │ same binary
           ▼
  ┌─────────────────┐     ┌──────────────────────┐
  │ Firebase Dist.   │     │ EAS Submit           │
  │ (sonora-team)    │     │ (Google Play API)    │
  └─────────────────┘     └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ Play Console          │
                          │ Closed Testing track  │
                          │ (draft, needs human)  │
                          └──────────────────────┘
                                     │
                              human promotes
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ Production track      │
                          │ (Play Console UI)     │
                          └──────────────────────┘
```

### Key Principle

**Same binary, two destinations**. The signed AAB is built once, then distributed to both Firebase (as APK for testers) and Google Play (as AAB for production rollout). No rebuild needed — the same version goes to both channels.

---

## 3. Business Rules & Decisions

| Rule                 | Decision                                                                        |
| -------------------- | ------------------------------------------------------------------------------- |
| **Release cadence**  | Manual — a human triggers the production workflow, CI builds + uploads as draft |
| **Play Store track** | Closed Testing (email-gated), human promotes to Production via Play Console UI  |
| **Account required** | Google Play Developer account ($25 USD one-time fee)                            |
| **Upload mechanism** | Google Play Publishing API via service account JSON key                         |
| **EAS cloud**        | Not used — everything runs on GitHub Actions runners (local EAS builds)         |
| **Multi-channel**    | Same binary → Firebase App Distribution + Google Play Closed Testing            |
| **In-app auth**      | Not needed — distribution control is through Play Store Closed Testing track    |
| **Production env**   | Play Store publishing only runs on production workflow, never staging           |

---

## 4. Scope

### What's In

1. **New AAB build profile** in `eas.json`
   - Profile `aab` — signed Android App Bundle for Play Store submission
   - Uses local keystore (not EAS-managed credentials)
   - Sets `buildType: "app-bundle"`

2. **Keystore generation & CI injection**
   - Generate a production keystore (one-time, done locally)
   - Store as GitHub Actions secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
   - Write keystore to disk during CI build via `echo "$KEYSTORE_BASE64" | base64 -d`

3. **EAS Submit profile** in `eas.json`
   - New `submit` section with `production` profile
   - Configures Google Play service account credentials
   - Points to the correct Play Console listing

4. **Updated GitHub Actions workflow** (production only)
   - Add AAB build step alongside existing APK build
   - Add EAS Submit step after successful build
   - Add Play Store specific output handling

5. **Google Play Console setup guide**
   - Create developer account
   - Create app listing (internal name, description, screenshots, etc.)
   - Create Closed Testing track
   - Add service account to Play Console users
   - Initial listing review (required before first upload)

6. **Makefile updates**
   - New targets for AAB build, Play Store submission

### What's Out (Non-Goals)

- ❌ Fully automated publishing to Production track — human promotion required
- ❌ iOS / App Store Connect — Android-only change
- ❌ In-app authentication or licensing — distribution control via Play Console
- ❌ EAS cloud dependency — everything runs locally on GitHub runners
- ❌ Staging → Play Store — staging stays Firebase-only
- ❌ Play Store listing management (screenshots, descriptions, etc.) — one-time setup, not pipeline
- ❌ Multiple Play Store tracks (Internal Testing, Open Testing) — start with Closed Testing only
- ❌ In-app updates or Play In-App Review API — pure distribution pipeline

---

## 5. Implementation Approach

The work proceeds in **two phases** to minimize risk and allow testing of each piece independently.

### Phase 1: Signing + AAB (incremental, testable without Play Console)

1. Generate production keystore locally via `keytool`
2. Add `aab` profile to `eas.json` with keystore config
3. Add GitHub Actions secrets for keystore credentials
4. Modify production workflow to build AAB alongside APK
5. Test: verify CI produces a signed AAB locally (skip upload)
6. **Delivery**: CI builds signed AABs and stores them as artifacts

### Phase 2: Play Store Submission (needs Play Console ready)

1. Create Google Play Developer account + complete listing
2. Create service account + grant Play Console permissions
3. Add `submit` profile to `eas.json` for Google Play
4. Add EAS Submit step to production workflow
5. Add Google Play service account JSON as GitHub secret
6. Test: upload to Closed Testing track as draft
7. **Delivery**: full pipeline — tag → build → Firebase + Play Store

---

## 6. Technical Details

### eas.json Changes

```json
{
  "build": {
    "production": {/* existing — keep for backward compat */},
    "preview": {/* existing — unchanged */},
    "aab": {
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EAS_BUILD_NO_EXPO_GO_WARNING": "1"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-sa-key.json",
        "track": "internal"
      }
    }
  }
}
```

### New Secrets Required

| Secret                         | Source                                              | Phase |
| ------------------------------ | --------------------------------------------------- | ----- |
| `KEYSTORE_BASE64`              | Local `keytool -genkey -exportcert`, base64-encoded | 1     |
| `KEYSTORE_PASSWORD`            | Password chosen during keystore creation            | 1     |
| `KEY_ALIAS`                    | Alias chosen during keystore creation               | 1     |
| `KEY_PASSWORD`                 | Key password (often same as keystore password)      | 1     |
| `ANDROID_SERVICE_ACCOUNT_JSON` | Google Cloud Console → Service Account → JSON key   | 2     |

### Keystore Config in eas.json

```json
{
  "build": {
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
      }
    }
  }
}
```

> **Note**: The keystore path in the CI write step would be `~/.android/sonora-production-keystore.jks` or `apps/mobile/sonora-production-keystore.jks` — to be resolved during implementation.

---

## 7. Risks & Mitigations

| Risk                                       | Likelihood | Impact                                           | Mitigation                                                                                            |
| ------------------------------------------ | ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Keystore loss**                          | Low        | Critical — cannot sign updates for existing app  | Backup keystore + passwords in secure vault (e.g., Bitwarden); document recovery procedure            |
| **Keystore compromise**                    | Low        | Critical — attacker could sign malicious updates | Restrict keystore secret access in GitHub; use environment protection rules                           |
| **Service account misconfiguration**       | Medium     | High — upload fails or wrong permissions         | Document exact Play Console permissions needed; test with dry-run first                               |
| **Play Store review delays**               | Medium     | Medium — first release delayed 24-48h            | Plan for it; submit well before planned launch date                                                   |
| **Play Developer account creation delays** | Medium     | High — blocks Phase 2 entirely                   | Create account early (Phase 1), while building AAB capability                                         |
| **AAB vs APK versionCode mismatch**        | Low        | Medium — can't upload if Play Console rejects    | Both artifacts derive versionCode from tag count (same source)                                        |
| **Play Store rejects app for policy**      | Low        | High                                             | Ensure app complies with Play Store policies before submission; do pre-submit audit                   |
| **Expo managed workflow limitations**      | Low        | Medium — some native configs not accessible      | Sonora is managed but EAS Build handles native compilation; no custom native code blocking Play Store |

---

## 8. Rollback Strategy

Each phase is independently reversible:

- **Phase 1 rollback**: Remove AAB profile from eas.json, delete AAB build step from workflow. Existing Firebase + APK pipeline is untouched.
- **Phase 2 rollback**: Remove EAS Submit step from workflow, revoke service account access in Play Console. Play Store listing stays but new releases go back to manual upload only.

**If a bad build reaches Closed Testing**: Unpublish the release in Play Console (draft → remove). No users received it because Closed Testing requires manual email approval.

---

## 9. Success Criteria

| Criterion                                                  | Verification                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| CI builds a signed AAB                                     | AAB artifact appears in GitHub Actions run output                               |
| AAB can be installed locally                               | `bundletool install-apks` or manual side-load via Play Console internal testing |
| Production workflow uploads to Play Console Closed Testing | Release appears as draft in Play Console → Closed Testing track                 |
| Same binary reaches Firebase + Play Store                  | Version code and version name match across both channels                        |
| Staging workflow is unaffected                             | Staging still builds unsigned APK, Firebase-only                                |
| Rollback works                                             | Reverting workflow changes restores old behavior                                |

---

## 10. Open Questions (Implementation Phase)

These will be resolved during spec/design:

1. Should the AAB build replace the APK build, or run alongside it? (Cost: longer CI vs maintaining both artifacts)
2. Which Play Store track as first upload target — `internal` (EAS Submit default) or `closed` (Closed Testing)?
3. Where to write the keystore in CI — repo-local or global path?
4. Should we extract APK from AAB for Firebase, or keep two separate builds?
5. What's the exact EAS Submit CLI command format for service-account-based auth?

---

## 11. Dependencies

- Google Play Developer account ($25 USD) — must exist before Phase 2
- Play Console app listing created (internal name, description at minimum)
- Service account with Play Console permissions
- GitHub secrets admin access to add new secrets
- EAS CLI version compatible with `submit` command (already >= 18.0.0)
