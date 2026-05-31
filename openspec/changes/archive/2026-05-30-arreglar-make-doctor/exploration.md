## Exploration: arreglar make doctor

### Current State

The `make doctor` target currently runs:

```makefile
doctor: ## Run React Doctor audit
	bunx react-doctor@latest
```

It runs react-doctor with **no flags at all**:

- **No `--verbose`** — only shows top 3 rules, hiding most diagnostics
- **No `--diff`** — always scans the full codebase
- **No `--fail-on`** — always exits 0 regardless of issues found
- **No `--score`** — doesn't output the numeric health score

CI (`.github/workflows/pr.yml`) already uses the `millionco/react-doctor@main` GitHub Action which does proper PR-diff scanning with inline annotations — CI is fine.

The `check` Makefile target was explicitly decoupled from `doctor` in commit `394f620` ("fix(ci): use official react-doctor action for PR diff scanning"), so `make check` no longer runs `doctor`.

### What the react-doctor skill expects

The skill at `.agents/skills/react-doctor/SKILL.md` defines **three distinct workflows**:

1. **Regression check** (after making React changes):

   ```
   npx react-doctor@latest --verbose --diff
   ```

   → Scan only changed files vs base branch, show all rules with file details.

2. **Full codebase cleanup**:

   ```
   npx react-doctor@latest --verbose
   ```

   → Full scan with verbose per-file detail. Fix by severity (errors → warnings).

3. **/doctor — full local triage workflow** (when user types `/doctor`):
   → Fetch the canonical playbook from `https://www.react.doctor/prompts/react-doctor-agent.md`
   → Follow its scan → filter → triage → fix → validate loop
   → Edits the working tree directly (never commits, never opens PRs)
   → This is an **agent-driven interactive workflow**, not a Makefile target.

### What's Missing or Broken

| Issue                                              | Impact                                                        |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `--verbose` missing                                | Only top 3 rules shown — user can't see most diagnostics      |
| No `--diff` variant for quick regression           | Each run takes longer than needed for a diff check            |
| No `--fail-on`                                     | `make doctor` always passes even if react-doctor finds issues |
| No `/doctor` playbook integration                  | Full triage workflow requires manually fetching the playbook  |
| Target name `doctor` implies it catches all issues | Doesn't align with skill's 3-workflow model                   |

### Approaches

1. **Add `--verbose` to existing target** (minimal fix)
   - **Pros**: Single-line change, immediately more useful output, matches the skill's "full cleanup" command
   - **Cons**: Still always full scan, no regression variant, no error exit on issues
   - **Effort**: Low (1 line)

2. **Add `--verbose --fail-on warning`** (medium fix)
   - **Pros**: User sees all diagnostics, exits non-zero on issues (blocks CI if integrated)
   - **Cons**: Full scan only; `--fail-on warning` may be too strict for local dev
   - **Effort**: Low (1 line)

3. **Two targets: `doctor` (full) + `doctor-diff` (regression)** (recommended fix)

   ```makefile
   .PHONY: doctor doctor-diff
   doctor: ## Run React Doctor full codebase audit
   	bunx react-doctor@latest --verbose

   doctor-diff: ## Run React Doctor regression check (changed files only)
   	bunx react-doctor@latest --verbose --diff --fail-on warning
   ```

   - **Pros**: Covers two of the three skill workflows; fails appropriately on diff checks; both use `--verbose`
   - **Cons**: Slightly more surface area; still doesn't cover the `/doctor` playbook workflow (by design — that's agent-driven)
   - **Effort**: Low (3-4 lines)

4. **Full overhaul: 3 targets + makefile doc** (complete fix)
   - `doctor` → full scan verbose
   - `doctor-diff` → regression check with `--fail-on warning`
   - `doctor-score` → `--score` only (quick health number)
   - Plus a comment block explaining each variant per the skill
   - **Pros**: Complete coverage of all react-doctor skill workflows, self-documenting
   - **Cons**: More targets to maintain; `/doctor` playbook still agent-only
   - **Effort**: Low-Medium (5-6 lines + docs)

### Recommendation

**Approach 3 (two targets)** is the sweet spot:

- `doctor` matches the skill's "full codebase cleanup" command exactly (`--verbose`)
- `doctor-diff` matches the skill's "regression check" command exactly (`--verbose --diff --fail-on warning`)
- `--fail-on warning` on `doctor-diff` makes it suitable for pre-commit or CI integration
- No change to the `/doctor` playbook workflow — that's agent-driven and cannot be replicated in a Makefile (it's a multi-step interactive loop that edits files)
- The CI workflow stays unchanged (it already uses `millionco/react-doctor@main`)

### Risks

- **None low**: Makefile changes are contained and trivially revertible
- `--fail-on warning` on `doctor-diff` may catch pre-existing issues in changed files — add `--fail-on error` instead if too noisy (the skill's regression workflow doesn't specify `--fail-on` but it's necessary for the target to be useful in automation)
- The `/doctor` playbook workflow remains agent-exclusive — user may expect `make doctor` to do everything

### Ready for Proposal

Yes. The change is straightforward: update the `doctor` target to use `--verbose` and add a `doctor-diff` target. No dependencies, no risks.
