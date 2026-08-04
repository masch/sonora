# Broccoli PR Approval Gate — manual Branch Protection setup

> **This is the ONLY enabling step for the gate, and it is MANUAL and NOT
> versioned in this repository.** Without it, the `broccoli-approval` workflow
> runs but is inert: its status has no effect on merges.

## Purpose

Single-author repositories cannot use GitHub's native "Require pull request
reviews" as a human merge gate, because GitHub blocks the author from approving
their own PR. This repo gates merges to `main` on a **human** approval signal
instead: the 🥦 (broccoli) emoji, authored as a comment on the PR.

The workflow `.github/workflows/broccoli-approval.yml` writes a single, stable
GitHub **Commit Status** with context **`Check PR 🥦`** on the PR
head SHA:

- On `synchronize` (new push) → `pending` (`Awaiting 🥦 broccoli comment...`),
  invalidating the previous approval.
- On `issue_comment` / `pull_request_review` (created/submitted **and edited**) →
  the LAST comment authored after the current head SHA decides: contains 🥦 or
  `:broccoli:` → `success`; otherwise → `failure`.
- Editing an approval comment/review re-evaluates the gate, so removing the
  🥦 from the last post-head item flips the status to `failure`.
- Older 🥦 comments are ignored; only the last post-head comment counts.

The workflow never writes the 🥦 itself. Only a human comment can grant
`success`.

## Steps (GitHub UI)

1. Open the repository on GitHub → **Settings**.
2. In the left sidebar, under **Code and automation** → **Branches**.
3. Next to the **`main`** branch protection rule, click **Edit** (or create the
   rule if none exists).
4. Under **Protect matching branches**, ensure the rule targets `main`.
5. Enable **Require status checks to pass before merging**.
6. In the search box under **Status checks that are required**, search for and
   select exactly:

   ```text
   Check PR 🥦
   ```

   - Capital **C** in "Check".
   - No leading/trailing whitespace, no extra spaces inside the context name.
   - Do not select any other check with a similar name (e.g. a Check Run) — the
     status context and a Check Run are different objects.

7. Keep any existing required CI checks as-is; this gate is additive.
8. Click **Save changes**.

### If the context does not appear in the search box

Branch Protection only lists status contexts that have already reported on a
recent commit. Open a PR to `main` first (or push to an existing one) so the
workflow reports `pending`, then repeat the search. This is also the first live
verification step below.

## Verification

### Status of a commit

```bash
gh api repos/{owner}/{repo}/commits/{sha}/status
```

Look for the entry whose `context` is `Check PR 🥦` and check its
`state`.

### Live end-to-end (after the workflow exists on `main`)

1. **Open a PR to `main`** → assert `Check PR 🥦` reports
   `pending` on the head SHA.
2. **Comment `LGTM 🥦`** → assert the same context flips to `success`.
3. **Push a new commit** (`synchronize`) → assert the context resets to
   `pending` on the NEW head SHA.
4. **Comment again without the emoji** → assert `failure`.
5. **Re-comment with 🥦 after the latest head** → assert `success`.

Negative: assert no Check Run named `Check PR 🥦` ever appears
(the historical collision, masch/sonora#374, must not reoccur).

## Design notes

- **Minimal permissions** (top-level, exactly four items):

  ```yaml
  permissions:
    contents: read
    issues: write
    pull-requests: write
    statuses: write
  ```

  `statuses: write` is the only permission added relative to `ci-pr.yml`'s set.
  Nothing broader (no `actions: write`, no `security-events`, no `packages`).

- **Concurrency** serializes gate events per PR and deliberately does NOT cancel
  an in-flight evaluation on a new push, so a valid approval is never dropped:

  ```yaml
  concurrency:
    group: broccoli-gate-${{ github.event.pull_request.number || github.event.issue.number }}
    cancel-in-progress: false
  ```

- **Never self-approve:** the workflow reads comments and updates the status
  only. It must never write the 🥦 into any comment; only a human-authored 🥦
  comment can produce `success`.
