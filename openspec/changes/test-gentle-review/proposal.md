# Proposal: test-gentle-review

## Intent

Add a visible badge/test line to `README.md` at the top of the file. This is not a product feature — it exists solely to exercise the Gentle AI review pipeline end-to-end with a real, meaningful diff for the review system to analyze.

## Scope

**In scope:**

- One new visible line (badge or test label) inserted at the top of `README.md`, above the existing "Sonora" heading
- The content must be meaningful enough to produce a non-trivial diff (not whitespace-only)
- The change flows through the full SDD pipeline: proposal → spec → design → tasks → apply → verify → archive

**Out of scope:**

- Any product functionality, styling, UX, business logic
- Changes beyond `README.md`
- Permanent content — this line is a test artifact and may be removed after verification

## Affected Areas

| Area         | Impact                                                                |
| ------------ | --------------------------------------------------------------------- |
| `README.md`  | One line inserted at the top of the file                              |
| SDD pipeline | All phases exercised end-to-end for the first time on this repository |

## Risks

| Risk                                                                           | Mitigation                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| The diff is too trivial for the review pipeline to produce meaningful analysis | Choose a badge/line that is structurally meaningful (e.g., a markdown image badge or a non-trivial test line) |
| The badge URL may be invalid or eventually disappear                           | Use a stable, universally resolvable badge URL (e.g., `https://img.shields.io/`)                              |
| The review pipeline may fail on small diffs and waste time debugging           | This is an explicit goal of the change — surface integration issues early                                     |

## Rollback

- Revert the single commit that introduces the change
- Remove the `README.md` line and commit the revert
- If the line is no longer needed post-verification, archive the change, then remove

## Success Criteria

1. A visible badge/test line appears at the top of `README.md`.
2. The diff is presentable to the Gentle AI review pipeline.
3. All SDD phases complete without pipeline errors.
4. The review pipeline produces findings on the diff (approvals, warnings, or suggestions).

## Assumptions

- The repository's `README.md` is the single entry point for this test.
- No approval or review from product stakeholders is needed — this is an infrastructure/test change.
- The existing `README.md` content and formatting should remain untouched beyond the insertion point.
