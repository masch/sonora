# Technical Design: Google Play Store Publishing Integration

## Architecture & Integration Plan

This document details the workflow modifications and authentication setup required to publish Android binaries (`.aab`) to Google Play Console and optionally to Firebase App Distribution.

---

## 1. Workflow Configuration Changes

Target File: `.github/workflows/deploy-mobile-android-production.yml`

### Inputs Schema

```yaml
on:
  workflow_dispatch:
    inputs:
      play_track:
        description: 'Google Play Track (internal, alpha, beta, production)'
        required: true
        type: choice
        options:
          - internal
          - alpha
          - beta
          - production
        default: 'internal'
      enable_firebase:
        description: 'Enable distribution to Firebase App Distribution'
        required: false
        type: boolean
        default: false
      firebase_groups:
        description: 'Firebase App Distribution Groups (comma-separated)'
        required: false
        type: string
        default: 'sonora-team'
```

---

## 2. Jobs Architecture

```
                 ┌──────────────────┐
                 │  build-android   │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │   sign-android   │
                 └────────┬─────────┘
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐
│ deploy-play-store│             │  deploy-firebase │
│ (always executed)│             │ (if: enable_... )│
└──────────────────┘             └──────────────────┘
```

### Job: `deploy-play-store`

- **Needs:** `sign-android`
- **Steps:**
  1. Download signed `.aab` artifact (`apps/mobile/sonora-*.aab`).
  2. Generate tag-based release notes using `.github/actions/generate-release-notes`.
  3. Execute `rddaley/upload-google-play@v4`:
     - `serviceAccountJsonPlainText: ${{ secrets.ANDROID_PLAY_SERVICE_ACCOUNT_JSON }}`
     - `packageName: com.sonora.app`
     - `releaseFiles: apps/mobile/sonora-*.aab`
     - `track: ${{ inputs.play_track || 'internal' }}`
     - `whatsNewDirectory: ...` (or inline release notes)

### Job: `deploy-firebase`

- **Condition:** `if: ${{ inputs.enable_firebase == true }}`

---

## 3. Google Play Service Account Setup Guide

1. **Google Cloud Console**:
   - Go to Google Cloud Console and select/create the GCP project linked to Google Play Console.
   - Enable **Google Play Android Developer API**.
   - Create a Service Account with role **Service Account User**.
   - Generate and download a Service Account Key in JSON format.

2. **Google Play Console**:
   - Navigate to **Users & permissions** -> **Invite new users**.
   - Enter the Service Account email address.
   - Grant permissions: **Releases** -> **Create, edit, and roll out releases**, **Manage testing tracks**.

3. **GitHub Repository Secret**:
   - Add the full contents of the JSON file as secret: `ANDROID_PLAY_SERVICE_ACCOUNT_JSON`.
