# Translations Sync Action Specification

## Purpose

Create auto-PRs that sync Postgres-stored PM translation overrides back into the git-tracked `.ts` locale files for developer review and merge.

## Requirements

### Requirement: Workflow Triggers

A `.github/workflows/sync-translations.yml` workflow MUST run on a weekly cron schedule (`0 6 * * 1` — Monday 06:00 UTC) AND support `workflow_dispatch` for manual triggering.

#### Scenario: Weekly cron fires

- GIVEN it is Monday 06:00 UTC
- WHEN the cron schedule triggers
- THEN the workflow starts executing

#### Scenario: Manual dispatch

- GIVEN a maintainer triggers via GitHub UI or CLI
- WHEN `workflow_dispatch` runs
- THEN the workflow starts executing with the same steps as the cron run

### Requirement: DB vs .ts Diff

The workflow MUST query all rows from `sonora.translations`, parse the current `.ts` locale files from the repo, and compute a key-by-key diff. A DB entry that differs from its `.ts` counterpart MUST be flagged as a change. Entries in the DB but absent from `.ts` files MUST be flagged as additions. Entries matching exactly MUST be excluded from the diff.

#### Scenario: Matching translations produce no diff

- GIVEN the DB has `('en', 'explore.title', 'Explore')` and `en.ts` has `explore.title: "Explore"`
- WHEN the diff runs
- THEN no change is reported for that key

#### Scenario: Changed value produces diff

- GIVEN the DB has `('en', 'explore.title', 'Discover')` but `en.ts` still has `explore.title: "Explore"`
- WHEN the diff runs
- THEN `explore.title` is flagged as changed

### Requirement: PR Creation

If the diff is non-empty, the workflow MUST create a new branch `chore/sync-translations-<date>`, apply changes to the relevant `.ts` files, commit with a descriptive message, and open a PR against `main`. If the diff is empty, the workflow MUST exit successfully with a message and create no PR.

#### Scenario: Diff detected creates PR

- GIVEN the workflow detects 3 changed keys
- WHEN the diff step completes
- THEN a branch `chore/sync-translations-2026-07-06` is created, `.ts` files are updated, and a PR is opened

#### Scenario: No differences found

- GIVEN all DB values match `.ts` values
- WHEN the diff step completes
- THEN the workflow exits with `"No changes detected"` and no PR is created

### Requirement: PR Content Convention

The PR MUST use title `chore: sync translations from admin panel — <date>`. The PR body MUST include a summary of changed keys, the source (PM admin panel overrides), and a reviewer checklist.

#### Scenario: PR body includes review checklist

- GIVEN a PR is created by the workflow
- WHEN the PR body renders
- THEN it contains `- [ ] Verify each changed string is accurate` and a table of old vs. new values per changed key
