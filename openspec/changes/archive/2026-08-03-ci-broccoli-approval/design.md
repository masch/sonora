# Design — CI Broccoli PR Approval Gate

## 1. Where the workflow lives (decision)

**Decision: add a NEW dedicated workflow file `.github/workflows/broccoli-approval.yml`.**
Do NOT add a job to `ci-pr.yml`.

Rationale:

- `ci-pr.yml` only triggers on `pull_request` (`opened, synchronize, reopened`) plus
  `workflow_dispatch`. It does NOT listen to `issue_comment` or `pull_request_review`, and
  adding those events to `ci-pr.yml` would entangle the gate with unrelated CI.
- The evaluation events (`issue_comment`, `pull_request_review`) resolve their event hub
  against the branch the workflow file exists on in the repo. Because a fresh feature-branch
  PR does not yet contain a new file, the workflow must already exist on `main` so the branch
  protection gate works from the first PR. A separate, always-versioned-on-main file is the
  clean contract.
- Isolating the gate keeps the status logic (and its `statuses: write` permission) out of the
  hot CI pipe, so a gate defect never blocks regular CI and a CI change never breaks the gate.

The reference style files are:

- `apps/mobile/.github/workflows/react-doctor.yml` — top-level `permissions` including
  `statuses: write` (the only in-repo precedent).
- `.github/workflows/security-audit.yml` — the in-repo example of `actions/github-script@v8`.

It runs on `ubuntu-latest`, needs no repo checkout.

## 2. Triggers (`on:`)

```yaml
name: Broccoli PR Approval Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]
  pull_request_review:
    types: [submitted]
  workflow_dispatch:
```

Notes:

- `pull_request` `reopened` (and `opened`) guarantees a `pending` status exists for Brand
  Protection on first evaluation (acceptance criterion "First push establishes pending").
- `issue_comment [created]` covers the primary human-approval signal.
- `pull_request_review [submitted]` covers a review submission (a human may express approval
  via a review comment instead of a plain comment).
- `workflow_dispatch` is optional but useful for manual re-evaluation with the head SHA is
  read from the PR at write-time.
- No `branches:` filter on `pull_request`: the job-level guard (next section) filters to `main`.

## 3. Default-branch guard and head SHA guarantee

- **base guard:** only act when the PR targets `main`
  (`pr.base.ref === 'main'`). Otherwise return without writing any status. This prevents the
  gate from applying to feature-branch or backport PRs.
- **head SHA guarantee:** always resolve the head SHA from a live `GET /repos/{owner}/{repo}/pulls/{number}`
  fetch inside the step (not from the event payload alone). This is the single source of truth
  for both the base ref and the head SHA at write time, which is what makes the
  `issue_comment` hub-resolves-against-base race impossible to the gate.
- The status is ALWAYS written to `head.sha`, never to `base.sha` and never to the SHA derived
  from the event hub branch.

## 4. Jobs / steps

Single job `broccoli-gate`, `runs-on: ubuntu-latest`, with an `if` guard and two logically
distinct branches inside one `actions/github-script@v8` step. No `actions/checkout` is
required (the script talks only to the REST API and needs no working tree). Keep it to one
script step for bounded, deterministic work.

```yaml
jobs:
  broccoli-gate:
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch' || github.event.pull_request != null || github.event.issue != null
    steps:
      - uses: actions/github-script@v8
        with:
          script: |
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            const { owner, repo } = context.repo;
            const CONTEXT = 'Check PR broccoli comment';
            const runUrl =
              `${process.env.GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${context.runId}`;

            // Single source of truth for number + base + head regardless of event type.
            const prNumber =
              (github.event.pull_request && github.event.pull_request.number) ||
              (github.event.issue && github.event.issue.number);
            if (!prNumber) return;

            const prRes = await github.rest.pulls.get({ owner, repo, pull_number: prNumber });
            const prData = prRes.data;

            // Only gate PRs targeting main.
            if (prData.base.ref !== 'main') {
              console.log(`PR #${prNumber} base is '${prData.base.ref}'; skipping gate.`);
              return;
            }

            const headSha = prData.head.sha;

            async function writeStatus(state, description) {
              await github.rest.repos.createCommitStatus({
                owner, repo, sha: headSha,
                context: 'Check PR broccoli comment',
                state, description, target_url: runUrl,
              });
              console.log(`status=${state} on ${headSha}: ${description}`);
            }

            const isSynchronize =
              context.eventName === 'pull_request' && github.event.action === 'synchronize';
            if (isSynchronize) {
              await writeStatus('pending', 'Awaiting 🥦 broccoli comment...');
              return;
            }

            // Evaluation events: issue_comment created, or review submitted/commented.
            const reviewState = github.event.review && github.event.review.state;
            const isCommentEval =
              context.eventName === 'issue_comment' ||
              (context.eventName === 'pull_request_review' &&
                (reviewState === 'submitted' || reviewState === 'commented'));
            if (!isCommentEval) return;

            // Head commit authoring time, to keep only comments authored after the head SHA.
            const headCommit = await github.rest.git.getCommit({ owner, repo, commit_sha: headSha });
            const headTime = new Date(headCommit.data.committer.date).getTime();

            const comments = await github.paginate(
              github.rest.issues.listComments,
              { owner, repo, issue_number: prNumber, per_page: 100 }
            );

            const postHead = comments.filter((c) => new Date(c.created_at).getTime() > headTime);
            if (postHead.length === 0) {
              await writeStatus('failure', 'No comment authored after the latest head SHA.');
              return;
            }

            const lastBody = postHead[postHead.length - 1].body || '';
            const broccoli = /\u{1F966}/u.test(lastBody) || /:broccoli:/u.test(lastBody);
            await writeStatus(
              broccoli ? 'success' : 'failure',
              broccoli
                ? 'Approved: last comment carries the 🥦 broccoli signal.'
                : 'Last comment has no 🥦 broccoli signal on the latest head.'
            );
```

Notes for the implementer:

- **Emoji constant:** 🥦 = `U+1F966`. Represent it as `/\u{1F966}/` (with the `u` flag) so the
  file stays encoding-safe. Match the literal emoji OR the shortcode `:broccoli:`.
- **"authored after head SHA":** compare each comment's `created_at` to the head commit's
  `committer.date` (via `GET /repos/{owner}/{repo}/git/commits/{sha}`). Strictly greater
  (`>`) keeps the commit-at-same-instant corner case from falsely approving.
- **Only the LAST such comment** in API order (ascending `created_at`) drives the outcome; the
  final element of the filtered array is the last one. Older 🥦 comments are ignored.
- **Never `success` from an empty/non-broccoli last comment** — that path must produce
  `failure`.
- **Never write the 🥦** — the script only reads comment bodies; it never inserts a comment.
- **`await sleep(...)`** is intentionally omitted here; add a temporary small delay only if a
  measured race on `headSha` appears in testing (see Section 6 design default is no delay).

## 5. Permissions

Top-level `permissions` (minimal, model on `react-doctor.yml`):

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
  statuses: write
```

- `statuses: write` is the ONLY new permission vs. `ci-pr.yml`'s existing set
  (`contents: read`, `issues: write`, `pull-requests: write`). This is acceptance criterion 7.
- `contents: read` is required for the `git` commit object read used to resolve the head
  committer date.
- `issues: write` + `pull-requests: write` allow reading comments/issues for the evaluation.
- Nothing broader (no `actions: write`, no `security-events`, no `packages`).

## 6. Concurrency and race handling

```yaml
concurrency:
  group: broccoli-gate-${{ github.event.pull_request.number || github.event.issue.number }}
  cancel-in-progress: false
```

- The group serializes all events for one PR in arrival order, so a `comment` evaluation that
  races a `synchronize` cannot both write on a stale snapshot; they run one after the other.
- `cancel-in-progress: false` is deliberate: unlike the CI/scan workflows, a new push must NOT
  cancel an in-flight comment evaluation, or a valid approval could be dropped.
- **Primary race defense is the fetch inside the step:** every evaluation re-reads PR head SHA
  and base ref at write time via `pulls.get`, so the status is always written against the
  current `head.sha`, not an event payload from earlier in the race.
- Per `synchronize`: exactly one status write (`pending`) on the freshly fetched head SHA.
- Per comment eval: one `pulls.get` + one `git.getCommit` + one comment-list paginate + one
  status write. Bounded, deterministic (same (head, event, comments) → same outcome).

## 7. Branch Protection (manual, outside the repo)

This is a manual, non-versioned enabling step (cannot be done safely from repo actions only).

In the GitHub repo settings → Branches → main branch protection, under
**Status checks that are required**:

- Add the required status check context exactly: **`Check PR broccoli comment`**
  (no leading/trailing whitespace, capital C).

Optional: keep existing CI checks required as-is; this gate is additive.

If the context is not required, the gate fails closed to inert (no `pending`/`success`/`failure`
affects merges). This is documented as a required configuration step for the change to be
effective.

## 8. Verification decisions

- **Structural readback:** open the new workflow file and confirm `permissions.statuses` is
  exactly the four-item set; confirm `concurrency.cancel-in-progress: false`; confirm all
  three top-level `on:` event groups and the constant `Check PR broccoli comment` context
  string.
- **YAML/syntax validation:** `actionlint` (if available in the repo tooling) or a plain
  parse; otherwise a dry-run `actions/github-script` syntax check.
- **Runtime verification (post-merge to `main`, live):** the workflow file must be on `main`
  for the branch-WORKFLOW events); a real PR evaluation:
  1. Open a PR to `main` → assert a `Check PR broccoli comment` status appears as `pending`
     on the head SHA (via `gh api repos/{owner}/{repo}/commits/{sha}/status`).
  2. Comment `LGTM 🥦` → assert the same context flips to `success`.
  3. Push a new commit (`synchronize`) → assert the context resets to `pending` on the NEW head SHA.
  4. Comment again without the emoji → assert `failure`.
  5. Re-comment with 🥦 after the latest head → assert `success`.
     These map 1:1 to proposal acceptance criteria 1–4 and 5.
- **Negative:** assert no new Check Run named `Check PR broccoli comment` appears (the
  collision #374 must not reoccur).
- **Permission assertion:** assert no workflow permission wider than `statuses: write` is
  added.

## Open questions / assumptions

- Analysis of head-commit-vs-comment timing uses the head commit's `committer.date`. If a
  build tooling re-commits with a far-future author date, prefer `committer.date` (already
  used). This is deterministic per spec scenario "Comment at or before head SHA is ignored".
