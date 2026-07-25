# SDD Exploration: Firebase Distribution Flows and Destinations

This document maps out the current destination logic and configuration for Firebase App Distribution across our GitHub Actions workflows and the `Makefile`.

---

## 1. Firebase Apps & Credentials

The project uses two separate Firebase Apps for Android distribution, matching Staging and Production:

| Env            | Firebase App ID                                 | Service Account Secret     | Local SA Key File                  |
| :------------- | :---------------------------------------------- | :------------------------- | :--------------------------------- |
| **Staging**    | `1:967212589494:android:d73fef12d655a13914e117` | `FIREBASE_SERVICE_ACCOUNT` | `apps/mobile/firebase-sa-key.json` |
| **Production** | `1:967054219260:android:61a953910f951dee060479` | `FIREBASE_SERVICE_ACCOUNT` | `apps/mobile/firebase-sa-key.json` |

---

## 2. Tester Groups Map

The following tester groups are configured/referenced across environments:

1. `dev-team` (Internal developers, defined locally as `FIREBASE_GROUP_DEV`)
2. `sonora-team` (Beta/stakeholder testers, defined locally as `FIREBASE_GROUP_SONORA`)
3. `external-testers` (External beta testers, used in staging workflows)

---

## 3. Distribution Flows Breakdown

### A. Local / Makefile Flows

In the `Makefile`, there are dedicated targets for staging and production that upload the built APK:

- **Staging App (`FIREBASE_APP_ID_STAGING`):**
  - `firebase-distribute-staging-dev` → Group: `dev-team`
  - `firebase-distribute-staging-sonora` → Group: `sonora-team`
  - `firebase-distribute-staging-all` → Groups: `dev-team,sonora-team`
- **Production App (`FIREBASE_APP_ID_PRODUCTION`):**
  - `firebase-distribute-prod-dev` → Group: `dev-team`
  - `firebase-distribute-prod-sonora` → Group: `sonora-team`
  - `firebase-distribute-prod-all` → Groups: `dev-team,sonora-team`

### B. CI / GitHub Actions Flows

- **Staging Workflow (`deploy-mobile-android-staging.yml`):**
  - **Trigger:** `workflow_dispatch` (manual) or `workflow_call` (via `deploy-all-staging.yml`).
  - **Input:** `firebase_team` (choice: `internal` or `external`, default: `internal`).
  - **Destination/Groups:**
    - If `firebase_team == 'external'` → `external-testers` group.
    - If `firebase_team == 'internal'` (default) → `dev-team` group.
  - **App ID:** Staging App ID (`1:967212589494...`).

- **Production Workflow (`deploy-mobile-android-production.yml`):**
  - **Trigger:** `workflow_dispatch` (manual) or `workflow_call` (via `deploy-all-production.yml` which triggers every 3 days on cron or manual).
  - **Input:** `firebase_groups` (string, default: `'all'`).
  - **Destination/Groups:**
    - Resolves to `${{ inputs.firebase_groups || github.event.inputs.firebase_groups || 'dev-team' }}`.
    - **Note on cron runs:** Since cron runs have no inputs, it falls back to `'dev-team'`.
  - **App ID:** Production App ID (`1:967054219260...`).

---

## 4. Inconsistencies & Gaps Identified

1. **Staging Group Names Inconsistency:**
   - CI uses `external-testers` and `dev-team`.
   - Makefile uses `dev-team` and `sonora-team` (but does not reference `external-testers`).
2. **Production Default Mismatch:**
   - `deploy-mobile-android-production.yml` defines the default input as `all`.
   - But `deploy-all-production.yml` passes `${{ github.event.inputs.firebase_groups || 'dev-team' }}` as input, resulting in `dev-team` being the actual default when calling it.
   - Also, the `distribute-firebase` command falls back to `'dev-team'` if no inputs are resolved, overriding the `'all'` defined in the input spec.
3. **Duplicate logic vs DRY Makefile execution:**
   - Currently, GitHub Actions workflows duplicate the exact `firebase appdistribution:distribute` CLI command inline instead of invoking the Makefile targets. This makes maintaining destination lists and commands duplicate and error-prone.

---

## 5. Proposed Refactoring Strategy

1. **Standardize Makefile Groups:**
   - Introduce variables in Makefile to align with all groups (including `external-testers`).
2. **Reuse Makefile in CI:**
   - Modify the workflows to execute `make firebase-distribute-...` (passing appropriate env variables) to avoid duplicating CLI pathing, CLI options, and token setup.
3. **Clarify defaults:**
   - Standardize default tester groups so manual and automated cron runs behave predictably.
