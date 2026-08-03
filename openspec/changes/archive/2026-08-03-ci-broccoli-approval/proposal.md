# Proposal: Manual 🥦 Broccoli PR approval gate

## Executive summary

Single-author repositories cannot use GitHub's native "Require pull request reviews" as a
human merge gate, because GitHub blocks the author from approving their own PR. This repo
needs a _human_ approval signal before its `main` branch can receive merged PRs, rather than
relying only on automatic CI checks.

This change introduces a manual reviewer gate driven by the 🥦 (broccoli) emoji: a PR's merge
is enabled only when the emoji is present in the **last** human comment on the PR, and every
new push to the PR (`synchronize`) invalidates the previous approval. The mechanism uses the
**GitHub Commit Statuses API** with a single, unique status context (`Check PR broccoli
comment`) updated in place on the head SHA — not native Check Runs (which previously collided)
and not native reviews (which a single author cannot self-approve).

## Problem / context

- **Single-author repository.** The owner cannot approve their own PR through GitHub's native
  "Require pull request reviews", so that native signal is unusable as a human gate.
- **Avoid CI-only merging.** The user does not want merges gated solely on automatic checks;
  a human must affirmatively approve each PR before it merges.
- **Previous Check Run collision (issue masch/sonora#374).** Two native Check Runs sharing the
  same name on the same SHA (one failure, one success) blocked merges via Branch Protection.
  Native Check Runs must not be used for this gate.
- **One precedent.** Only `apps/mobile/.github/workflows/react-doctor.yml` currently uses
  `statuses: write`; `security-audit.yml` is the sole in-repo example of `actions/github-script@v8`.

## Objectives

1. Provide a manual, human-affirmed approval mechanism for merging PRs into `main`.
2. Expose that approval as a single, stable GitHub status context so Branch Protection can
   require it without reproducing the Check Run collision.
3. Invalidate the approval on every new push (`synchronize`) to the PR, forcing a fresh 🥦
   comment after the latest head SHA before the merge can proceed.
4. Never block the pipeline via a required job whose `skipped` state counts as failure.

## Non-objectives

- Not a replacement for, nor a change to, any existing CI job or check.
- Not implementing native "Require pull request reviews".
- Not using Check Runs / workflow jobs to carry the gate.
- Not versioning or enforcing Branch Protection config from inside this repo (enforced manually).
- Not emitting the 🥦 automatically from the workflow; the emoji must be authored by the human.

## Proposed mechanism

### Triggers

A dedicated workflow (or a dedicated job set within `ci-pr.yml`) listens to:

- `pull_request: [synchronize]` → resets the status to `pending`.
- `issue_comment` and `pull_request_review_comment` → evaluates the last comment and flips the
  status to `success`/`failure`.

### Workflow shape

- Short dedicated job(s) using `actions/github-script@v8` (style ref: `security-audit.yml`).
- Permissions: add `statuses: write` to the workflow (currently `contents: read`,
  `pull-requests: write`, `issues: write`). This is the only missing permission.
- Status context constant: `Check PR broccoli comment`.

### Status transitions

- **On `synchronize` (new head SHA):** `createCommitStatus` → `state: pending`,
  `context: 'Check PR broccoli comment'`, description like `Awaiting 🥦 broccoli comment...`,
  `target_url: <run url>`.
- **On any comment** (`issue_comment` / `pull_request_review`): fetch the PR's comments via
  `repos/{owner}/{repo}/issues/{number}/comments`, take the **last** comment authored after the
  head SHA:
  - if the last comment body contains the 🥦 emoji → `state: success`;
  - otherwise → `state: failure`.
- Always target `github.event.pull_request.head.sha` (never the base SHA) to avoid the
  `issue_comment` hub resolving against `main`.

### Why Commit Statuses, not Check Runs

- Check Runs of the same name on the same SHA collide (the historical failure).
- A single stable status context is updated in place, so there is exactly one status object per
  context, and Branch Protection can require it cleanly.
- A `pending` status can exist upfront so Branch Protection is never seen as "unstarted".

## Configuration requirements (manual, outside the repo)

Branch Protection for `main` must be configured (via GitHub UI or API, not versioned here) to:

- **Require status checks** to pass before merging, including the status context
  **`Check PR broccoli comment`**.
- Optionally require CI checks as-is (unchanged from current behavior).

This is the only enabling step and cannot be applied from this repository alone without
`gh bash` against the protected branch.

## Measurable acceptance criteria

1. A new PR to `main` gets a `pending` status with context `Check PR broccoli comment` on its
   head SHA.
2. Posting a comment ending in the 🥦 emoji **after** the latest head SHA flips that status to
   `success` on the same head SHA.
3. Pushing a new commit (`synchronize`) immediately resets the status back to `pending` on the
   new head SHA, invalidating the prior approval.
4. A pre-existing or non-last 🥦 comment does **not** flip the status to `success`.
5. The status is always written against `github.event.pull_request.head.sha`, never the base SHA.
6. No native Check Run with the context name is created (no Check collision).
7. The workflow adds exactly `statuses: write` to its permissions; no broader permission is added.

## Risks, tradeoffs, and edge cases

- **Required-status configuration is not versioned.** If Branch Protection does not require the
  `Check PR broccoli comment` context, the gate is inert. Mitigation: document and perform the
  manual config as part of this change; verify with the protected-branch API.
- **Race between `issue_comment` and PR event state.** Guard by always using the head SHA
  instead of the resolved base.
- **Skipped job / check-run fallback must be avoided.** Implement only as a status update, never
  as a required job whose `skipped` counts as a failure.
- **First-push pending.** The `pending` status must exist before Branch Protection evaluates the
  required context, otherwise the check may be reported as "expected but not reported".
- **Single-author token limitation.** `GITHUB_TOKEN` is the acting identity; the workflow must
  never emit the 🥦 itself. The emoji is a human-authored comment.
- **Comment flooding / long threads.** Only the last comment body matters; older 🥦s are ignored.
- **Malformed or empty last comment.** No emoji → `failure` (never a false approval).

## Scope

### In

- One new workflow file (or a dedicated job set in `ci-pr.yml`) implementing the commit-status
  gate with `statuses: write`.
- `pending` reset on `synchronize`; `success`/`failure` evaluation from the last comment.
- Documentation of the required Branch Protection status context.

### Out

- Any change to existing CI jobs or checks.
- Branch Protection automation from this repo.
- Native "Require pull request reviews".
- Fixing the historical Check Run collision (prevented by design, not refactored).
