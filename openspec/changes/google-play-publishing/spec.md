# Google Play Publishing Specification

## Purpose

Enable Sonora's CI/CD pipeline to build a signed Android App Bundle (AAB) and submit it to the Google Play Console Internal Testing track as a draft release, alongside the existing Firebase App Distribution and GitHub Release pipeline. The Play Store publishing path is production-only, human-triggered, and requires manual promotion from Internal Testing to Production.

## Capabilities

### New Capability: Google Play Store Publishing

The system SHALL build a signed Android App Bundle (AAB) and submit it to the Google Play Console as part of the production CI/CD workflow.

---

## Functional Requirements

### Requirement: Signed AAB Build

The system MUST produce a signed Android App Bundle (`.aab`) artifact from the production CI workflow.

#### Scenario: CI produces a signed AAB from a production tag

- GIVEN a production workflow run (triggered manually or from `deploy-all-production.yml`)
- WHEN the build step completes for the `aab` EAS profile
- THEN a file with extension `.aab` SHALL exist in the apps/mobile directory
- AND the AAB SHALL be signed with the production keystore
- AND the AAB SHALL have a versionCode matching the current tag count
- AND the AAB SHALL have a versionName derived from `prod-v{major.minor.patch}`

#### Scenario: AAB build uses the same versionCode as the existing APK build

- GIVEN a production workflow run
- WHEN the versionCode is calculated from `git tag -l "prod-v*" | wc -l`
- THEN the same versionCode value SHALL be used for both the AAB and the existing APK build

### Requirement: Play Store Submission

The system MUST submit the signed AAB to the Google Play Console after a successful build.

#### Scenario: Production workflow submits AAB to Play Console

- GIVEN a successful signed AAB build
- WHEN the EAS Submit step runs with the `production` submit profile
- THEN the AAB SHALL be uploaded to the Google Play Console
- AND the release SHALL appear in the configured track (Internal Testing track) as a draft
- AND the release SHALL NOT be rolled out to end users automatically

#### Scenario: Submission failure does not block Firebase distribution

- GIVEN a successful signed AAB build
- WHEN the EAS Submit step fails (e.g., network error, API rejection)
- THEN the workflow SHALL continue to distribute the APK to Firebase App Distribution
- AND the workflow SHALL emit a warning but NOT fail the overall workflow run
- AND the AAB artifact SHALL remain available in GitHub Actions artifacts

### Requirement: Keystore Injection in CI

The system MUST inject the production keystore into the CI runner before the AAB build.

#### Scenario: Keystore is written from secret before build

- GIVEN a production workflow run
- WHEN the AAB build step starts
- THEN the keystore SHALL have been written to `apps/mobile/sonora-production-keystore.jks` from the `KEYSTORE_BASE64` secret
- AND the keystore file SHALL be read by the EAS Build local process during the `aab` profile build

#### Scenario: Keystore does not exist in CI for non-production workflows

- GIVEN a staging workflow run
- WHEN the workflow executes
- THEN no keystore SHALL be written
- AND the AAB profile SHALL NOT be invoked
- AND the existing unsigned APK build SHALL be unaffected

### Requirement: Service Account Injection in CI

The system MUST inject the Google Play service account JSON key into the CI runner before submission.

#### Scenario: Service account JSON is written from secret before submit

- GIVEN a production workflow run with a successful AAB build
- WHEN the EAS Submit step executes
- THEN the Google Play service account JSON SHALL have been written to `apps/mobile/google-play-sa-key.json` from the `ANDROID_SERVICE_ACCOUNT_JSON` secret
- AND EAS Submit SHALL authenticate using this service account key

### Requirement: Staging Workflow Isolation

The staging workflow MUST NOT build AABs or submit to Google Play.

#### Scenario: Staging workflow produces unsigned APK only

- GIVEN a staging workflow run
- WHEN the workflow executes
- THEN only the `preview` EAS profile SHALL be used
- AND no keystore SHALL be written
- AND no AAB SHALL be produced
- AND no Play Store submission SHALL occur
- AND the Firebase App Distribution SHALL work identically to current behavior

### Requirement: Rollback

The system MUST support reversible changes per phase.

#### Scenario: Phase 1 rollback restores original behavior

- GIVEN Phase 1 has been applied (AAB profile + keystore CI injection)
- WHEN the AAB profile and keystore step are reverted
- THEN the existing APK build for Firebase SHALL work identically
- AND no signed AAB SHALL be produced

#### Scenario: Phase 2 rollback removes Play Store submission

- GIVEN Phase 2 has been applied (submit profile + workflow step)
- WHEN the submit step and submit profile are reverted
- THEN the AAB build SHALL continue to work
- AND Firebase distribution SHALL continue to work
- AND no Play Store submission SHALL occur

---

## Non-Functional Requirements

### Requirement: Keystore Security

The production keystore MUST NOT be stored in plaintext in the repository, workflow files, or CI logs.

#### Scenario: Keystore is never logged or committed

- GIVEN the production keystore exists as a GitHub Actions secret (`KEYSTORE_BASE64`)
- WHEN the CI runs
- THEN the keystore content SHALL NOT appear in workflow logs
- AND the keystore file SHALL be covered by `.gitignore` (`*.jks`)
- AND the keystore SHALL only exist on the CI runner filesystem during the build

### Requirement: Service Account Security

The Google Play service account JSON key MUST NOT be stored in plaintext in the repository or CI logs.

#### Scenario: Service account key is never logged or committed

- GIVEN the service account JSON exists as a GitHub Actions secret (`ANDROID_SERVICE_ACCOUNT_JSON`)
- WHEN the CI runs
- THEN the service account content SHALL NOT appear in workflow logs
- AND the file SHALL be covered by `.gitignore`
- AND the file SHALL only exist on the CI runner filesystem during the submission step

### Requirement: CI Build Time Impact

The AAB build SHALL NOT increase total CI wall-clock time beyond 1.5x the current APK-only build time.

#### Scenario: AAB build runs within acceptable time

- GIVEN a production workflow run
- WHEN the AAB build completes
- THEN the total build time SHALL NOT exceed approximately 1.5x the current unsigned APK build time
- (Mitigation: the AAB build and APK build are currently sequential within the same job; target is to keep each under 15 minutes)

---

## Change Specification

### Files Changed

#### apps/mobile/eas.json

| Change                          | Type  | Details                               |
| ------------------------------- | ----- | ------------------------------------- |
| Add `build.aab` profile         | ADDED | New profile for signed AAB builds     |
| Add `submit.production` profile | ADDED | New profile for Play Store submission |

**`build.aab` profile specification:**

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

**`submit.production` profile specification:**

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

#### Makefile (root)

| Change                                | Type  | Details                   |
| ------------------------------------- | ----- | ------------------------- |
| Add `eas-build-android-aab-ci` target | ADDED | Build signed AAB in CI    |
| Add `eas-submit-android` target       | ADDED | Submit AAB to Google Play |

**`eas-build-android-aab-ci` target:**

```makefile
.PHONY: eas-build-android-aab-ci
eas-build-android-aab-ci: eas-whoami ## Build signed AAB for Google Play in CI (requires KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD from env)
 cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile aab --local --output="$(OUTPUT_AAB)"
```

**`eas-submit-android` target:**

```makefile
.PHONY: eas-submit-android
eas-submit-android: eas-whoami ## Submit AAB to Google Play (requires ANDROID_SERVICE_ACCOUNT_JSON written to disk)
 cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) submit -p android --profile production
```

#### .github/workflows/deploy-mobile-android-production.yml

| Change                                   | Type  | Details                                               |
| ---------------------------------------- | ----- | ----------------------------------------------------- |
| Add keystore write step before AAB build | ADDED | Writes KEYSTORE_BASE64 to file                        |
| Add AAB build step                       | ADDED | Builds signed AAB via `make eas-build-android-aab-ci` |
| Add AAB artifact upload                  | ADDED | Saved alongside APK artifact                          |
| Add `aab_path` job output                | ADDED | Output for artifact propagation                       |
| Add `submit-play-store` job              | ADDED | Downloads AAB, writes SA key, submits via EAS Submit  |
| Fail-continue on submit                  | ADDED | `continue-on-error: true` on submit job               |

#### .github/workflows/deploy-all-production.yml

| Change            | Type      | Details                                              |
| ----------------- | --------- | ---------------------------------------------------- |
| No changes needed | UNCHANGED | Secrets inherit automatically via `secrets: inherit` |

### New Files

#### docs/play-store-setup.md (NEW)

Detailed guide for:

- Creating a Google Play Developer account
- Creating the app listing in Play Console
- Setting up the Internal Testing track
- Generating the service account and granting permissions
- Generating the production keystore
- Uploading the first build
- Promoting from Internal Testing to higher tracks

---

## Secrets Specification

### New Secrets

| Secret                         | Source                                                      | Used In                                             | Format                                            | Phase |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------- | ----- |
| `KEYSTORE_BASE64`              | Local `keytool -genkey -exportcert`, then `base64` encode   | `deploy-mobile-android-production.yml` (write step) | Base64-encoded JKS keystore file                  | 1     |
| `KEYSTORE_PASSWORD`            | Chosen during keystore creation                             | `eas.json` (env var interpolation)                  | Plain text password                               | 1     |
| `KEY_ALIAS`                    | Chosen during keystore creation (e.g., `sonora-production`) | `eas.json` (env var interpolation)                  | Plain text alias string                           | 1     |
| `KEY_PASSWORD`                 | Chosen during keystore creation                             | `eas.json` (env var interpolation)                  | Plain text password                               | 1     |
| `ANDROID_SERVICE_ACCOUNT_JSON` | Google Cloud Console → Service Account → JSON key           | `deploy-mobile-android-production.yml` (write step) | JSON key file content (single line or prettified) | 2     |

### Secret Scoping

All new secrets SHALL be stored in the `production` GitHub Actions environment (matching existing pattern for `FIREBASE_SERVICE_ACCOUNT`). They SHALL NOT be accessible from the `staging` environment.

### Keystore Backup

The keystore SHALL be backed up offline:

- Generate a backup of the `.jks` file (encrypted)
- Store keystore + passwords in a secure password manager (e.g., Bitwarden)
- Document recovery procedure in `docs/play-store-setup.md`

---

## Configuration Specification

### Keystore Format

| Property                | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Format**              | JKS (Java KeyStore)                                                            |
| **Algorithm**           | RSA (2048-bit key)                                                             |
| **Validity**            | 10,000 days (or manually chosen)                                               |
| **DN**                  | `CN=Sonora, OU=Development, O=Sonora Derivadas Poeticas, L=Buenos Aires, C=AR` |
| **Alias**               | `sonora-production`                                                            |
| **File location in CI** | `apps/mobile/sonora-production-keystore.jks`                                   |
| **.gitignore**          | Covered by existing `*.jks` entry                                              |

### Service Account Format

| Property                 | Value                                                         |
| ------------------------ | ------------------------------------------------------------- |
| **Google Cloud project** | The project linked to Google Play (same Firebase project)     |
| **Service account name** | `sonora-play-publisher`                                       |
| **Role/Permission**      | "Service Management" → "Release Manager" role in Play Console |
| **Key type**             | JSON                                                          |
| **File location in CI**  | `apps/mobile/google-play-sa-key.json`                         |
| **.gitignore**           | Add `google-play-sa-key.json` entry                           |

### Play Console Track Names

| Track            | API Name             | Used For                     | Automated?                        |
| ---------------- | -------------------- | ---------------------------- | --------------------------------- |
| Internal Testing | `internal`           | CI submission target (draft) | Yes — EAS Submit pushes here      |
| Closed Testing   | `closed` (or custom) | Gated user testing           | No — human promotes from Internal |
| Production       | `production`         | Public release               | No — human promotes from Closed   |

---

## Verification Specification

### Phase 1 Verification

| Test                              | Method                                                                             | Pass Criteria                                           |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Keystore generation               | Run `keytool` locally, verify `.jks` exists                                        | Keystore file exists, passwords work                    |
| Local signed AAB build            | `make eas-build-android-aab-ci OUTPUT_AAB=test.aab` locally with keystore in place | Produces `test.aab`, signed, valid                      |
| AAB signature verification        | `jarsigner -verify -verbose -certs test.aab`                                       | "jar verified"                                          |
| CI AAB build (dry run, no submit) | Push to branch, manually trigger production workflow with keystore secrets set     | AAB artifact in GitHub Actions run                      |
| Staging unaffected                | Trigger staging workflow                                                           | No keystore written, no AAB produced, unsigned APK only |

### Phase 2 Verification

| Test                        | Method                                                                            | Pass Criteria                                                              |
| --------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Service account validation  | `gcloud auth activate-service-account --key-file=google-play-sa-key.json` locally | Auth succeeds                                                              |
| Play Console listing exists | Log into Play Console                                                             | App listing is created, Internal Testing track exists                      |
| CI submit to Play Store     | Trigger production workflow with all secrets                                      | Release appears in Play Console → Internal Testing track as draft          |
| Same binary both channels   | Compare version codes from Firebase APK and Play Console AAB                      | Identical version codes and version names                                  |
| Submission failure handling | Temporarily break service account key, trigger workflow                           | Workflow warns but does not fail; Firebase + GitHub Release still complete |
