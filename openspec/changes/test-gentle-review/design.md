# Design: test-gentle-review

## Overview

Insert a Shields.io badge as the first line of `README.md`, followed by a blank line,
before the existing `# Sonora` heading. This is an infrastructure/test change with no
product impact — its sole purpose is to exercise the Gentle AI review pipeline
end-to-end.

## Design Decisions

### Mechanism: `edit` tool with exact-text replacement

| Aspect               | Decision                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Tool                 | `edit` (exact-text match on `# Sonora` heading)                                                                                          |
| Why                  | Preserves the existing file byte-for-byte; single atomic operation; no temp files; no risk of trailing whitespace or encoding corruption |
| Alternative rejected | `write` (whole-file) — unnecessary risk of byte-level drift from the original content below the insertion point                          |
| Alternative rejected | `sed` — fragile with multiline operations and special characters in badge URL                                                            |

### Precondition check

Before editing, read `README.md` and confirm its first non-blank line is exactly
`# Sonora`. If the heading has moved or the file has changed structurally, abort.

### Exact operation

1. **Read** `README.md` and verify `# Sonora` exists at the expected position.
2. **Edit** with a single `edit` call: find `# Sonora` and replace it with:

   ```
   [![Gentle AI Review](https://img.shields.io/badge/Gentle_AI_Review-Reviewed-brightgreen)](https://github.com/features/actions)

   # Sonora
   ```

3. **Read back** `README.md` to confirm lines 1–3 match the expected format.

### Resulting file structure

```
Line 1: [![Gentle AI Review](https://img.shields.io/badge/Gentle_AI_Review-Reviewed-brightgreen)](https://github.com/features/actions)
Line 2: (empty)
Line 3: # Sonora
Line 4+: (unchanged from original)
```

## Verification

| Step                     | Command/action                                  | Expected outcome                                                    |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------- |
| 1. Read back             | `read README.md`                                | Line 1 = badge markdown, line 2 = empty, line 3 = `# Sonora`        |
| 2. Git diff              | `git diff README.md`                            | +2 lines (badge + blank), 0 deletions, 0 modifications below line 3 |
| 3. Acceptance criteria 1 | Visual inspection on GitHub or markdown preview | Badge renders as bright green "Gentle AI Review \| Reviewed" image  |
| 4. Acceptance criteria 2 | Click the badge link                            | Link target is `https://github.com/features/actions`                |
| 5. Acceptance criteria 3 | Inspect line 3                                  | `# Sonora` is at line 3                                             |
| 6. Acceptance criteria 4 | `git diff --stat README.md`                     | 1 file changed, 2 insertions(+)                                     |
| 7. Acceptance criteria 5 | `git diff README.md \| wc -l`                   | Non-zero (meaningful diff)                                          |

**Note:** Criteria 1 and 2 require pushing to a remote and viewing the rendered
README. They can be checked locally with a markdown preview tool (e.g., `gh` CLI
or VS Code Markdown preview) but the definitive check is on GitHub after push.

## Rollback Plan

### Before commit (working tree not yet staged)

```bash
git checkout -- README.md
```

### After commit, before push

```bash
git revert HEAD --no-edit
```

### After push

```bash
git revert HEAD --no-edit
git push origin test/gentle-review-pipeline
```

### Post-verification permanent removal

If the badge is no longer needed after the pipeline test:

```bash
# From main or a cleanup branch
git revert <merge-commit-or-sha>
# Or simply edit README.md to remove lines 1-2 and commit
```

## Review Preparation

### Branch strategy

Create and switch to a dedicated branch:

```bash
git checkout -b test/gentle-review-pipeline
```

### Before invoking the review pipeline

The following steps prepare the change for the Gentle AI review system:

| #   | Action                 | Command                                                                                 |
| --- | ---------------------- | --------------------------------------------------------------------------------------- |
| 1   | Create branch          | `git checkout -b test/gentle-review-pipeline`                                           |
| 2   | Stage the changed file | `git add README.md`                                                                     |
| 3   | Verify staged diff     | `git diff --cached README.md` — confirms only badge + blank line                        |
| 4   | Commit                 | `git commit -m "test: add Shields.io badge to README.md for Gentle AI review pipeline"` |

### Invoking the review pipeline

After commit, run the review pipeline. Based on the project's existing `validate`
target and pre-commit hook (`.githooks/pre-commit`), the pipeline checks:

```
format-check → test-ci → lint → typecheck → doctor-ci → expo-doctor → gga
```

For this change, only `format-check` and `gga` (AI code review) are relevant.
The test/lint/typecheck steps will run but should be no-ops or pass since no
source code is modified.

**Lightweight alternative:** If the full `make validate` is too heavy for a
README-only change, run just:

```bash
make format-check
# Then invoke gga directly on the staged diff
```

### Pre-commit hook interaction

The pre-commit hook defined in `.githooks/pre-commit` will fire on `git commit`.
Since the hook runs `format-check`, Prettier may reformat `README.md`. Verify
that the badge line is not altered by the formatter by checking Prettier's
handling of markdown in `.prettierrc` (or similar config). If Prettier wraps
or reformats the badge markdown, accept the reformatted version as the final
staged content.

## Testing (Acceptance Criteria Verification)

| Criterion                                               | How to verify                                                                                                 | Pass/Fail            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1. Badge renders correctly                              | Open README in GitHub or markdown preview → bright green badge visible                                        | Visual               |
| 2. Badge links to `https://github.com/features/actions` | Inspect markdown link target or click badge                                                                   | `grep` or click test |
| 3. `# Sonora` remains at line 3                         | `head -3 README.md \| tail -1` returns `# Sonora`                                                             | Automated            |
| 4. `git diff` shows exactly 2 added lines, no deletions | `git diff --stat README.md` → `1 file changed, 2 insertions(+)` and `git diff README.md` shows only `+` lines | Automated            |
| 5. Non-trivial diff for review pipeline                 | `git diff README.md \| wc -l` > 3 (badge line + blank line = at least 2 lines of diff context)                | Automated            |

### Automated test script (optional)

For repeatable verification, a shell snippet:

```bash
echo "=== Verification: test-gentle-review ==="
head -3 README.md
echo "---"
git diff --stat README.md
echo "---"
echo "Badge link check:"
grep -c 'github.com/features/actions' README.md && echo "PASS" || echo "FAIL"
echo "Sonora at line 3:"
test "$(head -3 README.md | tail -1)" = "# Sonora" && echo "PASS" || echo "FAIL"
```

## Implementation Order (Next Phase)

For the `sdd-apply` phase, execute in order:

1. `git checkout -b test/gentle-review-pipeline` (if not already on it)
2. Read `README.md` and verify precondition (`# Sonora` exists)
3. Apply the `edit` operation
4. Read back and verify lines 1–3
5. `git add README.md`
6. `git diff --cached` to confirm the staged diff
7. `git commit` with conventional commit message
