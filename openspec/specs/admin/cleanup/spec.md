# Admin Cleanup Specification

## Purpose

Monthly automated maintenance to keep the repository healthy: close stale issues, delete stale branches and old workflow artifacts. Reduces noise and keeps project board focused.

## Requirements

### Requirement: ADC-1 — Monthly cron schedule

The workflow MUST trigger on a cron schedule once per month. It SHOULD also support `workflow_dispatch` for manual cleanup runs.

#### Scenario: Scheduled monthly run

- GIVEN the cron schedule fires (e.g., first day of month)
- WHEN the cleanup workflow triggers
- THEN it executes stale issue, branch, and artifact cleanup sequentially

### Requirement: ADC-2 — Stale issue closure

The workflow MUST identify issues with no activity for >60 days. It MUST add a "stale" label and close the issue with a comment noting the closure reason. Issues with label "pinned" or in project boards MUST be excluded.

#### Scenario: Stale issue closed

- GIVEN an issue with no comments or activity for 61 days
- WHEN the stale check runs
- THEN the issue gets labeled "stale"
- AND a comment is posted notifying of impending closure
- AND the issue is closed

#### Scenario: Active issue preserved

- GIVEN an issue with recent activity (last comment 5 days ago)
- WHEN the stale check runs
- THEN the issue is NOT labeled or closed

#### Scenario: Pinned issue excluded

- GIVEN an issue has the "pinned" label with no activity for 90 days
- WHEN the stale check runs
- THEN the pinned issue is excluded from stale processing

### Requirement: ADC-3 — Stale branch deletion

The workflow MUST delete branches that have been merged into `main` for >30 days. It MUST skip `main`, `develop`, and any `release/*` branches.

#### Scenario: Merged branch deleted

- GIVEN branch `feat/new-player` was merged 31 days ago
- WHEN the branch cleanup runs
- THEN the branch is deleted via the GitHub API

#### Scenario: Protected branch preserved

- GIVEN `main` has existed for 100 days
- WHEN the branch cleanup runs
- THEN `main` is not deleted

### Requirement: ADC-4 — Artifact cleanup

The workflow MUST delete workflow run artifacts older than 30 days using the GitHub Artifacts API.

#### Scenario: Old artifact removed

- GIVEN a workflow artifact dated 35 days ago
- WHEN the artifact cleanup runs
- THEN the artifact is deleted via the GitHub API
