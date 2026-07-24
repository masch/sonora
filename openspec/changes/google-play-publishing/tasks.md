# Tasks: Google Play Publishing for Sonora

## Review Workload Forecast

| Field                   | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| Estimated changed lines | Phase 1: ~60, Phase 2: ~270 (incl. docs)                              |
| 400-line budget risk    | Low                                                                   |
| Chained PRs recommended | Yes                                                                   |
| Suggested split         | PR 1 (Phase 1: Signing + AAB) → PR 2 (Phase 2: Play Store Submission) |
| Delivery strategy       | ask-on-risk                                                           |
| Chain strategy          | pending                                                               |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Low
```

**Why chained PRs**: Phase 2 is blocked on Play Console setup (account, listing, service account) which is an external dependency. Phase 1 is fully autonomous and testable immediately. Two-phase rollout matches the user-approved delivery plan.

**Decision needed**: Phase 2 requires Google Play Developer account ($25), app listing, and service account before apply. Phase 1 can proceed immediately.

---

## Phase 1: Signing + AAB Build

Zero external dependencies. Everything works on the current CI runner with secrets.

---

### Task 1.1: Generate production keystore and document procedure

**Description**: One-time manual step to generate a production JKS keystore using `keytool`. The procedure is documented in the Play Store setup guide.

**File(s) to modify**:

- `docs/play-store-setup.md` (NEW — will be created in Phase 2, but the instruction is documented)

**Procedure**:

```bash
keytool -genkey -v -keystore sonora-production-keystore.jks \
  -alias sonora-production \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -sigalg SHA256withRSA \
  -dname "CN=Sonora, OU=Development, O=Sonora Derivadas Poeticas, L=Buenos Aires, C=AR"
```

Then base64-encode for CI:

```bash
base64 -i sonora-production-keystore.jks | pbcopy
```

**Acceptance criteria**:

- Keystore file `sonora-production-keystore.jks` exists at `apps/mobile/`
- `keytool -list -keystore sonora-production-keystore.jks` shows alias `sonora-production`
- Keystore + passwords are backed up in a secure vault (Bitwarden or similar)
- Base64-encoded keystore is ready to paste into GitHub secret

**Estimated effort**: Medium (~20 min generation + backup)

**Design reference**: Section 4 (Signing Design), Section 8 (Phase 1)

---

### Task 1.2: Add `build.aab` profile to eas.json

**Description**: Add a new `aab` profile under `build` in `apps/mobile/eas.json` that produces a signed Android App Bundle with keystore credentials from environment variables.

**File(s) to modify**: `apps/mobile/eas.json`

**Change** (insert after existing `preview` profile):

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

**Acceptance criteria**:

- `eas.json` is valid JSON
- `bunx eas-cli build:list --profile aab` shows the profile (no error)
- Keystore env vars are interpolated at build time, not checked at parse time

**Estimated effort**: Small (~5 min)

**Design reference**: Section 2.1 (eas.json Profiles)

---

### Task 1.3: Configure GitHub Actions secrets for keystore

**Description**: Add 4 new secrets to the GitHub `production` environment for keystore credentials.

**Secrets to add**:

| Secret              | Value Source                                   | Scope                    |
| ------------------- | ---------------------------------------------- | ------------------------ |
| `KEYSTORE_BASE64`   | `base64 sonora-production-keystore.jks` output | `production` environment |
| `KEYSTORE_PASSWORD` | Password chosen during keystore creation       | `production` environment |
| `KEY_ALIAS`         | `sonora-production`                            | `production` environment |
| `KEY_PASSWORD`      | Key password (may match keystore password)     | `production` environment |

**Steps**:

1. Go to GitHub → Settings → Secrets and variables → Actions
2. Select the `production` environment
3. Add each secret with the correct value

**Verification**:

- Secrets are visible in the `production` environment (names listed, values masked)
- Secrets are NOT visible in the `staging` environment
- Confirmed via: `gh secret list --env production | grep -E "^KEYSTORE|^KEY_"`

**Acceptance criteria**:

- All 4 secrets exist under `production` environment
- Secrets are not accessible from `staging` workflow
- Keystore passwords and content never appear in repository or pipeline logs

**Estimated effort**: Small (~10 min)

**Design reference**: Section 2.4 (Secrets Management), Section 7 (Security)

---

### Task 1.4: Add AAB build target to Makefile

**Description**: Add a new Makefile target `eas-build-android-aab-ci` that builds the signed AAB using the `aab` profile. Mirrors the existing `eas-build-android-preview-ci` pattern.

**File(s) to modify**: `Makefile` (root)

**Change** (add after existing `eas-build-android-preview-ci` target):

```makefile
.PHONY: eas-build-android-aab-ci
eas-build-android-aab-ci: eas-whoami ## Build signed AAB for Google Play in CI (requires KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD from env)
 cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile aab --local --output="$(OUTPUT_AAB)"
```

Also add `OUTPUT_AAB` variable near `OUTPUT_APK` usage in the CI section (already handled via parameter passing in the workflow).

**Local test** (optional, requires local keystore):

```bash
make eas-build-android-aab-ci OUTPUT_AAB=test.aab
```

**Acceptance criteria**:

- `make eas-build-android-aab-ci` is listed in `make help`
- Target references `--profile aab` (not `preview`)
- Target accepts `OUTPUT_AAB` parameter (not `OUTPUT_APK`)
- Target requires `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` from env (documented in comment)

**Estimated effort**: Small (~5 min)

**Design reference**: Section 2.2 (Makefile Targets)

---

### Task 1.5: Add AAB build + keystore steps to production workflow

**Description**: Add three new steps to `deploy-mobile-android-production.yml` — keystore write, AAB build, and AAB artifact upload. Also add `aab_path` to build job outputs.

**File(s) to modify**: `.github/workflows/deploy-mobile-android-production.yml`

**Changes** (detailed positions in the design):

1. **Add `aab_path` to job outputs** (after existing `apk_path`):

   ```yaml
   outputs:
     apk_path: ${{ steps.build-apk.outputs.apk_path }}
     aab_path: ${{ steps.build-aab.outputs.aab_path }}
     tag_name: ${{ steps.get-tag.outputs.tag }}
   ```

2. **Add keystore write step** (after APK build, before AAB build):

   ```yaml
   - name: Write production keystore
     env:
       KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
     run: |
       echo "$KEYSTORE_BASE64" | base64 -d > apps/mobile/sonora-production-keystore.jks
   ```

3. **Add AAB build step** (after keystore write):

   ```yaml
   - name: Build Android AAB
     id: build-aab
     env:
       APP_ENV: production
       EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
       EAS_NO_INTERACTIVE: '1'
       APP_VERSION_CODE: ${{ steps.version-code.outputs.val }}
       EXPO_NO_DOCTOR: '1'
       KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
       KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
       KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
     run: |
       make eas-build-android-aab-ci OUTPUT_AAB="sonora-${{ steps.get-tag.outputs.tag }}.aab"
       echo "aab_path=apps/mobile/sonora-${{ steps.get-tag.outputs.tag }}.aab" >> "$GITHUB_OUTPUT"
   ```

4. **Add AAB artifact upload** (after existing APK upload):

   ```yaml
   - name: Upload Android AAB Artifact
     uses: actions/upload-artifact@v4
     with:
       name: android-aab
       path: apps/mobile/sonora-*.aab
       if-no-files-found: error
       retention-days: 7
   ```

**Acceptance criteria**:

- Workflow YAML is valid (`gh workflow inspect` or manual YAML check)
- Production workflow produces both APK and AAB artifacts
- AAB artifact named `android-aab` appears in successful workflow run
- Staging workflow is NOT modified (no keystore, no AAB)

**Estimated effort**: Medium (~20 min)

**Design reference**: Section 2.3 (Workflow Design), Section 8 (Phase 1)

---

### Task 1.6: Verify CI produces a signed AAB

**Description**: Trigger the production workflow manually and verify the AAB artifact is signed and valid.

**Verification steps**:

1. Push Phase 1 branch and ensure CI passes `make check`
2. Merge Phase 1 PR to main
3. Trigger production workflow manually (or wait for scheduled run)
4. After build completes, download the `android-aab` artifact from GitHub Actions
5. Verify signing:

   ```bash
   jarsigner -verify -verbose -certs sonora-*.aab
   ```

   Expected: `jar verified` with no warnings

6. Verify versionCode in AAB matches APK versionCode:

   ```bash
   # Extract versionCode from AAB (requires aapt2 or bundletool)
   bundletool dump manifest --bundle sonora-*.aab | grep versionCode
   ```

**Acceptance criteria**:

- AAB artifact exists in CI run output
- `jarsigner -verify` confirms the AAB is signed
- Version code in AAB matches the version code in the APK from the same run
- Staging workflow run produces zero AAB artifacts (unchanged)

**Estimated effort**: Medium (~30 min including CI wait time)

**Design reference**: Section 8 (Phase 1 Verification)

**Note on bundletool**: The design explicitly chose **two separate builds** (unsigned APK from `preview` profile, signed AAB from `aab` profile) rather than bundletool extraction. This avoids bundletool dependency and preserves the existing Firebase pipeline unchanged. APK extraction from AAB is not part of this change.

---

## Phase 2: Play Store Submission

All Phase 2 tasks are **blocked** on Play Console setup (account, app listing, service account). The code changes (2.4–2.7) can be implemented in parallel with the manual setup (2.1–2.3).

---

### Task 2.1: Create Google Play Developer account, app listing, and setup guide

**Description**: Manual one-time setup in Google Play Console. Create the developer account, create the app listing, and write a comprehensive setup guide at `docs/play-store-setup.md` covering all manual steps from both phases.

**Manual steps**:

1. Register for Google Play Developer account (play.google.com/console — $25 USD one-time fee)
2. Create new app in Play Console:
   - App name: "Sonora"
   - Default language: Spanish (or English — match user preference)
   - App or game: App
   - Free or paid: Free
3. Complete app listing essentials (at minimum: description, screenshots, categorization)
4. Set up pricing & distribution (free, all countries or target markets)
5. Accept Play Console developer agreements

**File(s) to create**: `docs/play-store-setup.md` (NEW)

The setup guide must document:

- Account creation process (link, cost, timeline)
- App listing creation steps
- Internal Testing track setup (Task 2.2)
- Service account creation (Task 2.3)
- Keystore generation (from Task 1.1)
- First upload procedure
- Promotion from Internal → Closed → Production
- Rollback instructions
- Keystore recovery procedure

**Acceptance criteria**:

- Google Play Developer account is active
- App "Sonora" exists in Play Console with package name `org.masch.sonora.app`
- `docs/play-store-setup.md` exists and covers all manual procedures
- Document is committed to the repository

**Estimated effort**: Large (~2-3 hours including account creation + listing + docs)

**Design reference**: Section 8 (Phase 2)

---

### Task 2.2: Create Internal Testing track in Play Console

**Description**: Configure the Internal Testing track in Play Console. This is the target for EAS Submit (`track: "internal"`).

**Steps**:

1. Go to Play Console → Select app → Testing → Internal Testing
2. Create Internal Testing track (if not auto-created)
3. Add testers (at minimum: the developer account itself)
4. Note: Internal Testing track accepts AAB uploads without full listing review

**Acceptance criteria**:

- Internal Testing track exists in Play Console
- Testers are configured (at minimum: dev account)
- Track is ready to receive AAB uploads via API

**Estimated effort**: Small (~15 min)

**Design reference**: Section 8 (Phase 2)

---

### Task 2.3: Create service account and grant Play Console permissions

**Description**: Create a Google Cloud service account for API access and grant it the Release Manager role in Play Console.

**Steps**:

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create service account named `sonora-play-publisher`
3. Generate JSON key → download and secure it
4. Go to Play Console → Settings → API Access
5. Grant the service account "Release Manager" permission
6. Verify: service account appears in Play Console API Access page

**Acceptance criteria**:

- Service account `sonora-play-publisher` exists in Google Cloud
- JSON key file is downloaded and stored securely
- Service account has "Release Manager" role in Play Console
- API access is enabled in Play Console

**Estimated effort**: Medium (~30 min)

**Design reference**: Section 2.4 (Secrets Management), Section 7 (Security)

---

### Task 2.4: Add `submit.production` profile to eas.json

**Description**: Add a new `submit` section to `apps/mobile/eas.json` with a `production` profile for Google Play submission.

**File(s) to modify**: `apps/mobile/eas.json`

**Change** (add after the closing `}` of the `build` object):

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

**Acceptance criteria**:

- `eas.json` is valid JSON with both `build` and `submit` sections
- `bunx eas-cli@20.1.0 submit --list-profiles` shows `production` profile (or doesn't error)
- Profile targets `track: "internal"` (Internal Testing)
- Profile references `google-play-sa-key.json` (not hardcoded credentials)

**Estimated effort**: Small (~5 min)

**Design reference**: Section 2.1 (eas.json Profiles)

---

### Task 2.5: Add Google Play service account JSON as GitHub secret

**Description**: Store the service account JSON key as a GitHub Actions secret for the `production` environment.

**Secrets to add**:

| Secret                         | Value Source                              | Scope                    |
| ------------------------------ | ----------------------------------------- | ------------------------ |
| `ANDROID_SERVICE_ACCOUNT_JSON` | Content of the Google Cloud JSON key file | `production` environment |

**Steps**:

1. Copy the entire JSON key file content
2. Go to GitHub → Settings → Secrets and variables → Actions → `production` environment
3. Add new secret `ANDROID_SERVICE_ACCOUNT_JSON` with the JSON content as the value

**Acceptance criteria**:

- `ANDROID_SERVICE_ACCOUNT_JSON` exists under `production` environment
- Secret is NOT accessible from `staging` environment
- JSON content never appears in repository files or CI logs

**Estimated effort**: Small (~5 min)

**Design reference**: Section 2.4 (Secrets Management)

---

### Task 2.6: Add EAS Submit step to production workflow + .gitignore update

**Description**: Add a new `submit-play-store` job to `deploy-mobile-android-production.yml` that downloads the AAB artifact, writes the service account key, and submits to Google Play via EAS Submit. Also add `google-play-sa-key.json` to `.gitignore`.

**File(s) to modify**:

- `.github/workflows/deploy-mobile-android-production.yml`
- `.gitignore`

**Workflow changes** (new job at the bottom of the file, after `deploy-firebase`):

```yaml
submit-play-store:
  runs-on: ubuntu-latest
  needs: build-android
  environment: production
  if: always() && needs.build-android.result == 'success'
  continue-on-error: true
  steps:
    - uses: actions/checkout@v5
      with:
        fetch-depth: 0
    - uses: ./.github/actions/setup
    - uses: actions/setup-node@v4
      with:
        node-version: '22.23.1'
    - name: Download Android AAB Artifact
      uses: actions/download-artifact@v4
      with:
        name: android-aab
        path: apps/mobile
    - name: Write Google Play service account key
      env:
        ANDROID_SERVICE_ACCOUNT_JSON: ${{ secrets.ANDROID_SERVICE_ACCOUNT_JSON }}
      run: |
        echo "$ANDROID_SERVICE_ACCOUNT_JSON" > apps/mobile/google-play-sa-key.json
    - name: Submit to Google Play
      env:
        EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
        EAS_NO_INTERACTIVE: '1'
      run: |
        make eas-submit-android
```

**.gitignore change**: Add the following line (near existing `firebase-sa-key.json`):

```
google-play-sa-key.json
```

**Acceptance criteria**:

- Workflow YAML is valid
- `submit-play-store` job runs after `build-android` succeeds
- Job has `continue-on-error: true` (failure does not block workflow)
- Job downloads AAB artifact from `build-android` job
- Service account key is written from secret, not committed
- `.gitignore` covers `google-play-sa-key.json`
- Running `git add apps/mobile/google-play-sa-key.json` fails (gitignore blocks it)

**Estimated effort**: Medium (~20 min)

**Design reference**: Section 2.3 (Workflow Design), Section 5 (Submission Flow), Section 6 (Error Handling)

---

### Task 2.7: Add Makefile target for submission

**Description**: Add a new Makefile target `eas-submit-android` that runs EAS Submit using the `production` submit profile.

**File(s) to modify**: `Makefile` (root)

**Change** (add after existing `eas-build-android-aab-ci` target):

```makefile
.PHONY: eas-submit-android
eas-submit-android: eas-whoami ## Submit AAB to Google Play (requires ANDROID_SERVICE_ACCOUNT_JSON written to disk)
 cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) submit -p android --profile production
```

**Acceptance criteria**:

- `make eas-submit-android` is listed in `make help`
- Target references `--profile production` (the submit profile in eas.json)
- No `--local` flag (eas submit runs locally by default)
- Target comments document the requirement of `ANDROID_SERVICE_ACCOUNT_JSON` on disk

**Estimated effort**: Small (~5 min)

**Design reference**: Section 2.2 (Makefile Targets)

---

### Task 2.8: Test full pipeline end-to-end

**Description**: Run the full production pipeline and verify the AAB reaches Play Console as a draft in the Internal Testing track.

**Prerequisites**:

- Phase 1 code merged (AAB profile, keystore secrets, Makefile target)
- Phase 2 code merged (submit profile, workflow job, service account secret)
- Play Console app listing exists (Task 2.1)
- Internal Testing track configured (Task 2.2)
- Service account has necessary permissions (Task 2.3)

**Verification steps**:

1. Push production tag (or trigger `deploy-all-production.yml` manually)
2. Monitor workflow run in GitHub Actions:
   - `build-android`: produces both APK and AAB ✅
   - `deploy-firebase`: distributes APK to Firebase (unchanged behavior) ✅
   - `submit-play-store`: runs after build, writes SA key, calls EAS Submit ✅
3. Go to Play Console → Select app → Testing → Internal Testing → Releases
4. Confirm the new release appears as **Draft**
5. Verify versionName and versionCode match the APK from the same run
6. Verify Firebase distribution still works (APK delivered to sonora-team group)
7. Verify submission failure is graceful:
   - Temporarily break the service account key
   - Trigger workflow
   - Confirm `submit-play-store` fails but `deploy-firebase` succeeds
   - Confirm workflow overall status is green (not failed)

**Acceptance criteria**:

- AAB appears in Play Console Internal Testing track as draft
- Version code in Play Store matches version code in Firebase APK
- Firebase distribution is unaffected by submission steps
- Submission failure does not block Firebase or GitHub Release
- AAB artifact is available in GitHub Actions artifacts for manual upload if needed
- Staging workflow still produces unsigned APK only

**Estimated effort**: Medium (~30 min including CI wait time)

**Design reference**: Section 8 (Phase 2 Verification), Section 6 (Error Handling)

---

## Rollback Plan

| Component                              | Rollback                                                              |
| -------------------------------------- | --------------------------------------------------------------------- |
| Phase 1 (AAB profile, keystore)        | Revert eas.json, Makefile, workflow changes. Remove keystore secrets. |
| Phase 2 (Submit profile, workflow job) | Revert submit config, workflow job, service account secret.           |
| Production workflow halting            | Revert `deploy-mobile-android-production.yml` to previous revision.   |

## Dependency Graph

```
Phase 1 Tasks (1.1-1.6) ─── fully autonomous ───→ can merge to main now
                                                      │
Phase 2 Manual Setup (2.1-2.3) ─── external ─────→ Play Console ready
                                                      │
Phase 2 Code (2.4-2.7) ─── can parallelize with 2.1-2.3 ──→ merge after 2.1-2.3
                                                      │
Phase 2 Verification (2.8) ─── depends on ALL Phase 2 tasks ──→ final step
```
