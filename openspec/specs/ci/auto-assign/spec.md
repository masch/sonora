# Auto Assign Reviewers Specification

## Purpose

Automatically assign code reviewers when a PR is opened or updated, based on the paths changed in the diff. Reduces manual triage and ensures the right people are notified.

## Requirements

### Requirement: AAR-1 — Trigger on PR events

The workflow MUST trigger on `pull_request` events: `opened`, `synchronize`, and `reopened`. It MUST NOT trigger on `pull_request` `edited` events (only title/body changes, no diff change).

#### Scenario: PR opened triggers assignment

- GIVEN a new PR is opened
- WHEN the auto-assign workflow triggers
- THEN it reads the PR's changed files
- AND assigns reviewers based on path patterns

### Requirement: AAR-2 — Path-based reviewer mapping

The workflow MUST map changed file paths to reviewer teams or individual GitHub usernames. Path patterns MUST use glob syntax. Mappings SHOULD be defined in a configuration file (e.g., `.github/auto-assign.yml`). At minimum the following paths MUST map to distinct reviewers: `apps/api/**` (API), `apps/mobile/**` (mobile), `apps/admin/**` (admin), `.github/workflows/**` (DevOps).

#### Scenario: API-only changes

- GIVEN a PR changes only `apps/api/src/routes.ts`
- WHEN the mapping runs
- THEN the API team reviewer is assigned
- AND no other reviewers are assigned

#### Scenario: Multi-app changes (cross-app PR)

- GIVEN a PR changes both `apps/api/` and `apps/mobile/` files
- WHEN the mapping runs
- THEN reviewers from both the API and mobile teams are assigned

#### Scenario: No path match

- GIVEN a PR changes only `README.md` or other unmatched paths
- WHEN the mapping runs
- THEN no reviewers are assigned
- AND the workflow succeeds (no error)

#### Scenario: Configuration file missing

- GIVEN `.github/auto-assign.yml` does not exist
- WHEN the workflow runs
- THEN the workflow SHOULD fail with a clear error message indicating missing config
