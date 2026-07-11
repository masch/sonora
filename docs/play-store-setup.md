# Google Play Store Setup Guide — Sonora

This guide covers two phases:

- **Phase 1** (✅ Applied): Keystore generation + signed AAB build in CI. No Play Console account required.
- **Phase 2** (📋 Manual): Play Console setup + service account + CI submission.

---

## Phase 1: Keystore + Signed AAB Build

Phase 1 is already applied to the branch. You need to:

1. Generate the keystore once (one-time manual step)
2. Configure GitHub secrets
3. Verify the pipeline works

### 1.1 Generate the Production Keystore

Run this command **on your local machine** (one-time):

```bash
keytool -genkey -v \
  -keystore sonora-production-keystore.jks \
  -alias sonora-production \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Sonora, OU=Development, O=Sonora, L=Buenos Aires, C=AR"
```

You will be prompted for:

- **Keystore password** — choose a strong password (save it immediately)
- **Key password** — can be the same as keystore password or different
- These values become `KEYSTORE_PASSWORD`, `KEY_PASSWORD`, and `KEY_ALIAS` (use `sonora-production`) secrets

#### Keystore Backup (⚠️ CRITICAL)

The keystore **cannot be recovered**. If lost, you must create a new one and all Play Store releases lose their signing key continuity.

Backup procedure:

1. **Encrypt the `.jks` file** with GPG or a password manager's file attachment:

   ```bash
   gpg --symmetric --cipher-algo AES256 sonora-production-keystore.jks
   ```

   This produces `sonora-production-keystore.jks.gpg` (encrypted with a passphrase).

2. **Store both** in a secure password manager (Bitwarden, 1Password, etc.):
   - `sonora-production-keystore.jks.gpg` (encrypted file)
   - The GPG passphrase
   - `KEYSTORE_PASSWORD`
   - `KEY_PASSWORD`
   - `KEY_ALIAS` (`sonora-production`)

3. **Add to `.gitignore`** — already covered by `*.jks` entry.

#### Encode for GitHub Secret

After generating, base64-encode the keystore for GitHub:

```bash
base64 -w0 sonora-production-keystore.jks | pbcopy
# macOS: copies to clipboard
# Linux:  base64 -w0 sonora-production-keystore.jks > keystore.b64
```

### 1.2 Configure GitHub Secrets

Add these **4 secrets** to the `production` environment in GitHub:

| Secret              | Value                      | Source                                      |
| ------------------- | -------------------------- | ------------------------------------------- |
| `KEYSTORE_BASE64`   | Base64-encoded `.jks` file | `base64 -w0 sonora-production-keystore.jks` |
| `KEYSTORE_PASSWORD` | Keystore password          | Chosen during `keytool -genkey`             |
| `KEY_ALIAS`         | `sonora-production`        | The `-alias` value from keytool             |
| `KEY_PASSWORD`      | Key password               | Chosen during `keytool -genkey`             |

**How to set them:**

1. Go to GitHub → Sonora repo → Settings → Environments → `production`
2. Add each secret under "Environment secrets"

**Secret scoping:**

- These secrets are only available to the `production` environment
- The `staging` workflow cannot access them
- GitHub Actions masks secret values in logs automatically

### 1.3 Verify the Pipeline

#### Local AAB Build (canary check before CI)

> **Prerequisites**: Java 17+, Android SDK, `sonora-production-keystore.jks` in `apps/mobile/`

```bash
# Place keystore in the expected location
cp sonora-production-keystore.jks apps/mobile/

# Export env vars (use the actual passwords)
export KEYSTORE_PASSWORD=<your-password>
export KEY_ALIAS=sonora-production
export KEY_PASSWORD=<your-key-password>

# Build unsigned APK + signed AAB
make eas-build-android-aab-ci OUTPUT_AAB=test.aab

# Verify AAB is signed
jarsigner -verify -verbose -certs apps/mobile/test.aab
```

Expected output: `jar verified.`

#### CI Pipeline Verification

1. Push the branch and manually trigger the `1-PROD Mobile Android` workflow
2. Confirm the workflow produces two artifacts: `android-apk` and `android-aab`
3. Download the AAB artifact and verify:

   ```bash
   jarsigner -verify -certs sonora-<tag>.aab
   ```

4. Confirm the `deploy-firebase` job is **unaffected** (APK still distributed to Firebase)

#### Staging Isolation Check

Trigger the staging workflow — confirm it produces only an unsigned APK, no AAB artifact, and no keystore-related steps appear in the logs.

### 1.4 Rollback (if needed)

Revert these files to undo Phase 1:

- `apps/mobile/eas.json` — remove the `aab` profile
- `Makefile` — remove `eas-build-android-aab-ci` target
- `.github/workflows/deploy-mobile-android-production.yml` — remove keystore write, AAB build, AAB upload steps, and `aab_path` output
- GitHub Secrets — delete `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

---

## Phase 2: Play Store Submission (Manual)

Phase 2 requires a Google Play Developer account and Play Console setup. This section documents the **manual steps** needed before enabling CI submission.

### 2.1 Create Google Play Developer Account

1. Go to [play.google.com/console](https://play.google.com/console)
2. Sign up for a Google Play Developer account ($25 one-time fee)
3. Complete account details (developer name, contact info)

### 2.2 Create App Listing in Play Console

1. Click "Create app" in Play Console
2. Fill in:
   - **App name**: Sonora
   - **Default language**: Spanish (Español)
   - **App or game**: App
   - **Free or paid**: Free
3. Complete the store listing:
   - Short description (80 chars max)
   - Full description (4000 chars max)
   - Screenshots (2-8, phone + tablet)
   - Icon, feature graphic, etc.
4. Complete the "App content" questionnaire (ratings, privacy policy, etc.)

### 2.3 Configure Tracks

1. Go to Production → Production → Create new release
   - (Not yet — we'll use Internal Testing first)

2. Go to Testing → Internal Testing
   - Click "Create track" if not already present
   - Add testers (email addresses of users who can install)

### 2.4 Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the project linked to your Firebase project
3. Go to IAM & Admin → Service Accounts
4. Click "Create Service Account"
5. Name: `sonora-play-publisher`
6. Grant these roles:
   - **Firebase**: Firebase Admin SDK Admin (or Firebase App Distribution Admin)
   - **Google Play**: You need to link the project in Play Console first

7. **Link to Play Console**:
   - Go to Play Console → Settings → API access
   - Click "Create new service account"
   - Follow the link to Google Cloud Console
   - Create the service account as above
   - Back in Play Console, click "Grant access" for the new service account
   - Permission: "Release Manager" (or "Admin" for full control)

8. Generate JSON key:
   - In Google Cloud Console → Service Accounts → `sonora-play-publisher`
   - Actions → Manage keys → Add key → Create new key → JSON
   - Download the JSON file securely

### 2.5 Add Service Account Secret to GitHub

Add one more secret to the `production` environment:

| Secret                         | Value                 | Source                                          |
| ------------------------------ | --------------------- | ----------------------------------------------- |
| `ANDROID_SERVICE_ACCOUNT_JSON` | Full JSON key content | Google Cloud Console → Service Account JSON key |

**Important**: The JSON key is a multiline value. When pasting into GitHub secrets, paste the entire file content (including newlines).

### 2.6 Enable CI Submission (Future PR)

When you're ready to enable automated CI submission, the following code changes are needed:

#### eas.json — Add submit profile

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

#### Makefile — Add submit target

```makefile
.PHONY: eas-submit-android
eas-submit-android: eas-whoami ## Submit AAB to Google Play (requires ANDROID_SERVICE_ACCOUNT_JSON written to disk)
 cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) submit -p android --profile production
```

#### .gitignore — Add service account key

```gitignore
# Google Play service account key (local)
google-play-sa-key.json
```

#### Workflow — Add `submit-play-store` job

A new `submit-play-store` job that:

1. Downloads the `android-aab` artifact
2. Writes the service account JSON from `${{ secrets.ANDROID_SERVICE_ACCOUNT_JSON }}`
3. Runs `make eas-submit-android`
4. Uses `continue-on-error: true` so submission failure doesn't block Firebase distribution

### 2.7 Verify Full Pipeline

After enabling CI submission:

1. Trigger the production workflow
2. Go to Play Console → Internal Testing → Releases
3. Confirm the AAB appears as a draft release
4. Manually promote: Internal Testing → Closed Testing → Production (via Play Console UI)

---

## Troubleshooting

| Problem                         | Likely Cause                                     | Solution                                                                  |
| ------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| AAB not produced                | Keystore missing or wrong password               | Verify `KEYSTORE_BASE64` is valid base64 and passwords match the keystore |
| `jarsigner` verification fails  | Keystore corrupted or wrong keystore             | Re-encode the keystore and update `KEYSTORE_BASE64`                       |
| AAB produced but unsigned       | EAS profile doesn't have credentials block       | Check `eas.json` `build.aab` has the `credentials.keystore` block         |
| Firebase still works but no AAB | Keystore step failed but APK succeeded           | Check build logs for "Write production keystore" step                     |
| Submission fails: 403           | Service account doesn't have Play Console access | Verify "Release Manager" permission in Play Console → API access          |
| Submission fails: 400           | App listing incomplete                           | Complete all required fields in Play Console store listing                |
| Submission fails: 409           | Version code already exists                      | Tag a new version (each tag + versionCode pair must be unique per track)  |

---

## References

- [EAS Build: Building APKs and AABs](https://docs.expo.dev/build-reference/android-builds/)
- [EAS Submit: Google Play](https://docs.expo.dev/submit/android/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)
- [Managing Keystores for EAS Build](https://docs.expo.dev/app-signing/local-credentials/)
