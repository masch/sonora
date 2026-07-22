# Tasks: test-gentle-review

## Review Workload Forecast

| Field                   | Value                               |
| ----------------------- | ----------------------------------- |
| Estimated changed lines | 2 (one badge line + one blank line) |
| 400-line budget risk    | Low                                 |
| Chained PRs recommended | No                                  |
| Suggested split         | single PR                           |
| Delivery strategy       | single-pr                           |
| Chain strategy          | pending                             |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

## Context

Insert a Shields.io badge as the first line of `README.md`, followed by a blank line, before `# Sonora`. This is a trivial infrastructure/test change (~2 lines) to exercise the Gentle AI review pipeline end-to-end. No source code, tests, or configuration files are modified.

**Pre-commit hook note:** The project's pre-commit hook runs `make format-check` then `make format` and auto-stages formatting fixes. Committing will trigger this — the badge line is ~145 chars and Prettier's `printWidth: 100` may wrap it. If the hook reformats, accept the reformatted version as the final staged content.

**Strict TDD Mode:** Enabled globally, but this change modifies `README.md` only — no executable code or tests. Verification is performed via acceptance criteria checks (diff inspection, line position, content match), not automated test suites. TDD RED/GREEN/REFACTOR cycle does not apply to this change.

## Implementation Tasks

### 1. Branch creation

- [x] Create the feature branch from the current working base:
      `bash
git checkout -b test/gentle-review-pipeline
`
      If the branch already exists from a previous attempt, delete and recreate:
      `bash
git branch -D test/gentle-review-pipeline
git checkout -b test/gentle-review-pipeline
`
      <!-- sdd-owner: implementation -->

### 2. Precondition check

- [x] Read `README.md` and verify the first non-blank, non-empty line is exactly `# Sonora` (no leading whitespace). If the heading has moved or the file has changed structurally, abort and report. <!-- sdd-owner: implementation -->

### 3. Edit README.md

- [x] Apply a single `edit` operation on `README.md`: find the exact text `# Sonora` and replace it with the badge line, a blank line, and `# Sonora`. The replacement text is:

      ```
                                                                              [![Gentle AI Review](https://img.shields.io/badge/Gentle_AI_Review-Reviewed-brightgreen)](https://github.com/features/actions)

                                                                              # Sonora
                                                                              ```

                                                                              Use exact-text replacement so all content below `# Sonora` remains byte-for-byte identical. <!-- sdd-owner: implementation -->

### 4. Read-back verification

- [x] Read `README.md` and confirm the first three lines match exactly:

      | Line | Expected content |
                                                                              |------|------------------|
                                                                              | 1 | `[![Gentle AI Review](https://img.shields.io/badge/Gentle_AI_Review-Reviewed-brightgreen)](https://github.com/features/actions)` |
                                                                              | 2 | *(empty)* |
                                                                              | 3 | `# Sonora` |

                                                                              If lines 1–3 do not match, undo with `git checkout -- README.md` and redo step 3. <!-- sdd-owner: implementation -->

### 5. Stage

- [x] Stage the changed file:
      `bash
git add README.md
`
      <!-- sdd-owner: implementation -->

### 6. Verify staged diff

- [x] Inspect the staged diff:
      `bash
git diff --cached README.md
`
      Confirm it shows exactly: - One added line (the badge markdown) - One added blank line - Zero deletions - Zero modifications to existing content below line 3 - No binary or unintended files staged <!-- sdd-owner: implementation -->

### 7. Format check

- [x] Run Prettier format check to confirm the badge line is not altered by the formatter:
      `bash
make format-check
` - If it **passes**, the badge line stays as-is. Proceed to commit. - If it **fails**, run `make format` (auto-fix), then re-stage with `git add README.md`, and re-run `make format-check` to confirm green. - Note any reformatting in the commit message body if relevant. <!-- sdd-owner: implementation -->

### 8. Commit

- [x] Commit with a conventional commit message:
      `bash
git commit -m "test: add Shields.io badge to README.md for Gentle AI review pipeline"
`
      The pre-commit hook will run automatically (format-check → test-ci → lint → typecheck → doctor-ci → expo-doctor → gga). For this README-only change: - `format-check`: should pass (verified in step 7), or auto-fix and re-stage. - `test-ci`, `lint`, `typecheck`: should be no-ops (no source changes). - `doctor-ci`, `expo-doctor`: should pass or produce non-blocking warnings. - `gga`: AI code review runs on the staged diff.

      If any step blocks the commit, investigate and resolve before force-committing. <!-- sdd-owner: implementation -->

### 9. Post-commit verification

- [x] Confirm the commit landed on the correct branch:
      `bash
git log --oneline -1
git branch --show-current
`
      The branch must be `test/gentle-review-pipeline`. <!-- sdd-owner: implementation -->

## Verification Against Acceptance Criteria

- [x] **AC 1 — Badge renders correctly:** Open `README.md` in a markdown preview (VS Code, `gh` CLI, or GitHub web after push). Confirm a bright green "Gentle AI Review | Reviewed" badge image is visible at the top of the file. <!-- sdd-owner: implementation -->
- [x] **AC 2 — Badge links correctly:** Inspect or grep the link target:
      `bash
grep 'github.com/features/actions' README.md
`
      Must return exactly one match on the badge line. <!-- sdd-owner: implementation -->
- [x] **AC 3 — `# Sonora` remains at line 3:**
      `bash
head -3 README.md | tail -1
`
      Must output `# Sonora`. <!-- sdd-owner: implementation -->
- [x] **AC 4 — `git diff` shows exactly 2 added lines, 0 deletions:**
      `bash
git diff --stat HEAD~1..HEAD
`
      Must show `1 file changed, 2 insertions(+)`. Verify no deletions or modifications. <!-- sdd-owner: implementation -->
- [x] **AC 5 — Non-trivial diff:**
      `bash
git diff HEAD~1..HEAD | wc -l
`
      Must be > 3 (badge line + blank line = at least 2 diff lines + context). <!-- sdd-owner: implementation -->

## Rollback Tasks (if needed)

- [x] **Before commit:** Undo working tree changes:
      `bash
git checkout -- README.md
`
      <!-- sdd-owner: implementation -->
- [x] **After commit, before push:** Revert the commit:
      `bash
git revert HEAD --no-edit
`
      <!-- sdd-owner: implementation -->
- [x] **After push:** Revert and force-push (or revert and push normally):
      `bash
git revert HEAD --no-edit
git push origin test/gentle-review-pipeline
`
      <!-- sdd-owner: implementation -->

## Post-Apply Review

- [x] Start or reuse a bounded review on the `test/gentle-review-pipeline` branch to validate the change against spec requirements. <!-- sdd-owner: parent -->
- [x] After review passes and the change is verified, archive the SDD change (`/sdd-archive`) to persist final state. <!-- sdd-owner: parent -->
