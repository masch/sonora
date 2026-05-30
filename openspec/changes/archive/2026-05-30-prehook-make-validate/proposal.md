# Proposal: Prehook — make validate

## Intent

Add a git pre-commit hook that runs `make validate` automatically, enforcing code quality (format → test → lint → typecheck → GGA review) before every commit. The hook is tracked in the repo and auto-configured so all contributors get it without manual setup.

## Scope

### In Scope

- Create `.githooks/pre-commit` shell script running full `make validate`
- Auto-stage files modified by `format` (prettier --write) within the hook
- Auto-configure `core.hooksPath` via `postinstall` in `package.json`
- Track `.githooks/` directory in version control

### Out of Scope

- No new `validate-fast` target (deferred)
- No hook manager dependency (husky, lefthook, etc.)
- No CI changes
- No GGA exclusion from pre-commit

## Capabilities

### New Capabilities

- `git-hooks`: Automated pre-commit validation via `make validate`, covering format, test, lint, typecheck, and GGA review

### Modified Capabilities

None — pure infrastructure addition, no spec-level behavior changes.

## Approach

1. Create `.githooks/pre-commit` as a bash script that runs `make validate`, re-stages any files modified by `prettier --write .`, and exits with the validate exit code.
2. Add `"postinstall": "git config core.hooksPath .githooks"` to `package.json` scripts — configures git on every `bun install`.
3. `.githooks/` is not in `.gitignore`, so it's automatically tracked in version control.

## Affected Areas

| Area                   | Impact   | Description                                         |
| ---------------------- | -------- | --------------------------------------------------- |
| `.githooks/pre-commit` | New      | Hook script: run validate, re-stage formatted files |
| `package.json`         | Modified | Add `postinstall` script for hooksPath config       |

## Risks

| Risk                                          | Likelihood | Mitigation                                                  |
| --------------------------------------------- | ---------- | ----------------------------------------------------------- |
| `format` mutates files + needs re-staging     | Certain    | Hook runs `git add -u` after validate completes             |
| GGA has 300s timeout → slow commits           | High       | User accepted this tradeoff; `--no-verify` bypass available |
| `postinstall` skipped with `--ignore-scripts` | Low        | Document in setup docs; rare edge case                      |
| Windows compatibility                         | Low        | Team uses Linux/macOS; shell script approach                |

## Rollback Plan

Remove `.githooks/` directory, remove `postinstall` from `package.json`, restore `core.hooksPath` to default (`git config --unset core.hooksPath`).

## Dependencies

None — zero external dependencies.

## Success Criteria

- [ ] `bun install` sets `core.hooksPath=.githooks` automatically
- [ ] `git commit` triggers `make validate` before committing
- [ ] Failed validation blocks the commit with non-zero exit code
- [ ] Formatted files are automatically re-staged when validate passes
