# CI Broccoli PR Approval Gate Specification

## Purpose

Provide a manual, human-affirmed merge gate for PRs into `main` in a single-author
repository, where GitHub's native "Require pull request reviews" is unusable because
the owner cannot self-approve.

The gate is driven by the 🥦 (broccoli) emoji: a PR is mergeable only while the status
context **`Check PR broccoli comment`** reports `success`, which happens only when the
**last** human comment authored after the current head SHA ends in the 🥦 emoji. Every new
push to the PR (`synchronize`) invalidates the prior approval by resetting the status to
`pending`, forcing a fresh human 🥦 comment after the new head SHA before merge can proceed.

The mechanism uses the **GitHub Commit Statuses API** with a single, stable status context
updated in place on the head SHA. It does **not** use native Check Runs (which previously
collided for the same name on the same SHA, see issue masch/sonora#374) and does not use
native reviews (which a single author cannot self-approve). The human must author the 🥦
comment; the workflow never emits it.

This behavior is delivered by a dedicated GitHub Actions workflow using
`actions/github-script@v8` (style reference: `security-audit.yml`), with only the
`statuses: write` permission added to the existing permission set. Branch Protection
configuration that requires the `Check PR broccoli comment` context is applied manually,
outside this repository, and is not versioned here.

## Requirements

### Requirement: Reset status to pending on synchronize

On every `pull_request` event of type `synchronize` (a new commit pushed to the PR), the
system MUST write a Commit Status to the PR's **head SHA** with the exact context
`Check PR broccoli comment`, state `pending`, a description indicating an awaiting
🥦 broccoli comment (e.g. `Awaiting 🥦 broccoli comment...`), and the workflow run URL as
`target_url`. This invalidates any prior approval on the previous head SHA.

#### Scenario: New push resets a previous approval

- GIVEN a PR whose `Check PR broccoli comment` context currently reports `success`
  on the previous head SHA after a 🥦 comment
- WHEN a `synchronize` event delivers a new head SHA
- THEN the status context on the new head SHA is `pending`
- AND the prior `success` value no longer applies to the new head SHA

#### Scenario: First push establishes pending

- GIVEN a new PR is opened on `main`
- WHEN its head SHA receives its first push evaluated by the gate
- THEN the `Check PR broccoli comment` context reports `pending` on that head SHA
- AND the `pending` state exists before Branch Protection evaluates the required context

### Requirement: Evaluate the last comment after the head SHA

On any `issue_comment` or `pull_request_review` event, the workflow fetches the PR's
issue comments via `GET repos/{owner}/{repo}/issues/{issue_number}/comments` and considers
only the authored comment whose `created_at` is after the PR's current head SHA's commit
timing. The evaluation uses only the last such comment; any comments created before or at
the head SHA are ignored.

The comment body is the human-authored message. The workflow sets the status based solely
on the content of this last post-approval comment, as specified in the requirement
"Commit status outcome from the last comment".

#### Scenario: Comment authored after head SHA is evaluated

- GIVEN a PR head SHA and at least one comment with `created_at` after that SHA
- WHEN an `issue_comment` or `pull_request_review` event triggers evaluation
- THEN only the last such comment body is inspected

#### Scenario: Comment at or before head SHA is ignored

- GIVEN comments whose `created_at` is at or before the current head SHA
- WHEN an evaluation runs
- THEN those comments do not influence the status outcome

#### Scenario: Empty or missing post-head comments

- GIVEN no comment exists after the current head SHA
- THEN the status is not reported `success` (per the outcome rule it reports `failure`)

#### Scenario: Emoji match ignores unrelated content

- GIVEN a last post-head comment whose body contains the 🥦 emoji or its common shortcode
  (e.g. `:broccoli:`) amid other text
- WHEN the evaluation inspects the body
- THEN the body still counts as carrying the 🥦 signal

### Requirement: Emoji outcome rules

The system SHALL set the status outcome for the `Check PR broccoli comment` context on the
head SHA as follows:

- if the last post-head comment body contains a 🥦 emoji or the `:broccoli:` shortcode →
  `success`
- otherwise (non-broccoli last comment, or no comment at all) → `failure`
- never a `success` from an outdated or non-last comment

#### Scenario: No post-head broccoli comment fails

- GIVEN the last post-head comment does NOT contain 🥦 or no comment exists after the
  head SHA
- WHEN an evaluation runs
- THEN the `Check PR broccoli comment` context reports `failure` (never a false approval)

#### Scenario: Pre-existing broccoli is not current

- GIVEN an earlier 🥦 comment that is followed by at least one non-🥦 post-head comment
  or is before the head SHA
- WHEN an evaluation runs
- THEN the context reports `failure` because it is not the last post-head comment

### Requirement: Single stable status target and context

All status writes use the exact constant context `Check PR broccoli comment` and target the
PR's head SHA
(`github.event.pull_request.head.sha`), never the base SHA and never the commit state
resolved from the `hub`/base branch. This guarantees exactly one status object per context,
which Branch Protection can require cleanly.

#### Scenario: Status targets head SHA on every event type

- GIVEN `synchronize`, `issue_comment`, or `pull_request_review` events
- THEN the status is always written against `head.sha`
- AND never against the base SHA even when the event hub the repo could otherwise
  resolve against the base branch

#### Scenario: Single stable context

- GIVEN repeated evaluations over a PR's life
- THEN only one context named `Check PR broccoli comment` exists on the head SHA, updated
  in place per the transition (no duplicate contexts, no native Check Run with that name)

### Requirement: No native Check Run, minimal permissions

The gate MUST be implemented as a Commit Status update only. It MUST NOT create a native
Check Run sharing the context name, and MUST NOT appear to Branch Protection as a required
job whose `skipped` state counts as failure (implement only as a status update). The
workflow SHALL add exactly the `statuses: write` permission to its existing
`contents: read`, `pull-requests: write`, `issues: write` set, and MUST NOT add any broader
permission.

#### Scenario: No Check Run collision

- GIVEN the gate runs on a PR where the historical Check Run collision (#374) occurred
- WHEN the gate updates the approval signal
- THEN the signal is a Commit Status context only, therefore the collision cannot reoccur

#### Scenario: Permission footprint is minimal

- WHEN the gate workflow is defined
- THEN its top-level `permissions` include `statuses: write` in addition to the existing
  read/write set and nothing broader

### Requirement: Never emit the emoji automatically

The workflow MUST NOT write the 🥦 emoji into any comment itself. The 🥦 signal is only
ever produced by a human-authored comment; the workflow only reads existing comments and
updates the status.

#### Scenario: Human authors the emoji

- GIVEN the single-author repo and `GITHUB_TOKEN` acting as the author
- WHEN approval is required
- THEN only a human-authored 🥦 comment can transition the context to `success`

#### Scenario: Workflow never self-approves

- WHEN the workflow runs evaluation
- THEN it never inserts a 🥦 comment, so it can never grant itself `success`

### Requirement: Performance and determinism of a short job

The gate runs as short job(s) with bounded work: one status write for `synchronize`, and one
comments list plus one status write for a comment event. The result for a given (head SHA,
event, comment set) is deterministic: the same inputs yield the same status outcome.

#### Scenario: Bounded work per event

- GIVEN `synchronize` → exactly one status write
- GIVEN `issue_comment`/`pull_request_review` → one comments-list call plus one status
  write
- THEN the job completes promptly without unbounded loops or flooding

#### Scenario: Deterministic outcome

- GIVEN two runs with identical head SHA and identical last post-head comment
- THEN both produce the identical status outcome

### Requirement: Resilience to event/race ordering

The gate must never be blocked or emit conflicting status due to the race between an
`issue_comment` hub resolving to the base branch and the PR state. This is guaranteed by
always targeting `head.sha`. A fetch which reports no newer comment never yields a false
`success`.

#### Scenario: Race between comment and synchronize

- GIVEN a race between an `issue_comment` event and a `synchronize`
- WHEN the status is written
- THEN it targets the head SHA and reports appropriately (pending after a newer push, or the
  comment-eval outcome on the matching SHA)

#### Scenario: Missing expected state reports non-success

- GIVEN only a base-resolved (`hub`) or empty comment set and latest head
- THEN the context reports `failure`/`pending` accordingly and never a false `success`

---

See the proposal (`proposal.md`) for the fixed product decisions (Commit Statuses API,
unique context `Check PR broccoli comment`, invalidate on `synchronize`, no native Check
Runs or reviews, only `statuses: write`).
