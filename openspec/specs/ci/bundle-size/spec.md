# Bundle Size Check Specification

## Purpose

Prevent bundle size regressions on pull requests to `main`. Every PR that modifies source code MUST be checked for bundle size impact against the base branch.

## Requirements

### Requirement: BSC-1 — Trigger on PRs to main

The workflow MUST trigger on `pull_request` events targeting the `main` branch. It SHOULD trigger on `pull_request` synchronized events (new commits pushed to the PR).

#### Scenario: PR opened against main

- GIVEN a new PR is opened targeting `main`
- WHEN the bundle-size workflow triggers
- THEN it computes the bundle size from the PR's head commit
- AND compares it against the base branch

### Requirement: BSC-2 — Diff reporting

The workflow MUST compute the total production bundle size and compare it against the base branch. It MUST post a PR comment with the size diff (added, removed, total, and percentage change). SHOULD break jobs into "compute size" per app (mobile, admin, api).

#### Scenario: Bundle size decreased

- GIVEN the PR reduces total bundle size by 5%
- WHEN the diff is computed
- THEN the PR comment shows a decrease with delta
- AND the workflow passes

#### Scenario: Bundle size exceeds threshold

- GIVEN the PR increases bundle size by 15% (threshold: 10%)
- WHEN the diff is computed
- THEN the PR comment shows the increase
- AND the workflow fails with a size violation message

#### Scenario: No baseline available

- GIVEN the base branch has no cached size measurement (e.g., first run)
- WHEN the workflow runs
- THEN it measures the base branch first as baseline
- THEN it computes and reports the PR diff (no failure for lack of baseline)

### Requirement: BSC-3 — Threshold enforcement

The workflow MUST have a configurable size increase threshold (default: 10% of total bundle bytes). A PR that exceeds this threshold MUST fail the workflow.

#### Scenario: Small increase under threshold

- GIVEN the PR increases bundle size by 3% (below 10%)
- WHEN the threshold check runs
- THEN the workflow passes with a warning in the comment
