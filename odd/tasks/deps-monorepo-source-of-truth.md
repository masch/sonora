# Tasks: Monorepo Dependency Source of Truth

**Feature**: `deps-monorepo-source-of-truth`
**Branch**: `chore/deps-monorepo-source-of-truth`
**Delivery Strategy**: `ask-on-risk`

## Specs

- **S1** — User's request, verbatim: "implementarlo en esta rama de forma completa, no importa los cambios hasta ahora y verificar si queda alguno otro hueco que no cumpla con la regla del @AGENTS.md"
- **S2** — The repository gains one declared source of truth for the versions that must be uniform across workspaces, and it is the mechanism the toolchain already provides: the `catalog` block of the root `package.json`. Every workspace that declares a cataloged package references it as `"catalog:"` and never restates the version, so one shared bump is one edit in the catalog.
- **S3** — `scripts/check-deps.ts` validates the repository against that catalog and reports every violation with the kind, workspace, package, declared value and expected value: `catalog-literal` (a cataloged package restated as a literal), `cross-workspace-drift` (the same package at two versions across workspaces, which is the only rule that covers the SDK-managed packages the catalog deliberately omits) and `stale-catalog` (a catalog entry no workspace references). Validation never mutates anything. It derives the workspace list from the root `workspaces` globs and accepts the catalog declared either at the root or inside the `workspaces` object.
- **S4** — There is no apply/write mode, because there is nothing to write: the version lives in the catalog, so a failure is corrected by editing the catalog or the manifest by hand. `make deps-check` is the entry point and the `deps-sync` target introduced earlier is removed.
- **S5** — Bun catalogs work on the pinned toolchain. Corrected after S5 originally claimed they do not exist: `bun 1.3.14` resolves `"catalog:"` from the root `catalog` block and `bun install --frozen-lockfile` is clean over 2108 installs. The earlier `failed to resolve` was a wrong declaration shape in the experiment, not a missing capability (see `L3` in the Log for the superseded finding).
- **S6** — The mechanism must not override the Expo SDK matrix or `minimumReleaseAge`. `expo install --check` stays the authority for SDK-aligned native modules, and no path may reduce the release-age policy.
- **S7** — `AGENTS.md` §10 documents the mechanism that actually ships: the catalog, the three checks `make deps-check` performs, the packages deliberately left out of the catalog and why, and the SDK-matrix boundary.
- **S8** — Audit the repository for remaining gaps against `AGENTS.md` rules in the dependency and tooling area, and fix the ones that are in scope. At minimum the known one: the `expo-upgrade` target prompts for a release age of `0 = immediate`, which directly contradicts §10's "must NEVER ... reduce this value".
- **S9** — Git rules hold: no commits on `main`, work stays on `chore/deps-monorepo-source-of-truth`, no `--no-verify`, no `--amend`.
- **S10** — Tests follow the existing convention: `bun:test` inside `scripts/__tests__/`, exercising the public CLI rather than the internals.
- **S11** — Neither the documentation nor the pull request may assert that a platform capability is absent without reproducing the failure of the documented shape. The discarded claim "catalogs do not exist on the pinned bun" reached `AGENTS.md` §10 and the PR body from a single malformed experiment, and had to be retracted.

## Known gaps found during the audit

| #   | Gap                                                                                                                                                                              | Rules   | In scope |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| G1  | `make expo-upgrade` offers `0 = immediate` for the release age, contradicting §10                                                                                                | S8      | yes      |
| G2  | `scripts/pin-deps.ts` hardcodes `TARGET_FILES` to four manifests, so a new workspace is silently skipped (same class of bug as the hardcoded `Makefile` list fixed in `72224fe`) | S8      | reported |
| G3  | Nothing detects a declared dependency that no workspace imports; `test-renderer` is declared and unused                                                                          | S8      | reported |
| G4  | Five manifests pin their own versions with no cross-workspace check, which is how `@types/node` drifted to 26.1.0 at the root and 26.0.1 in `apps/api`                           | S2      | yes      |
| G5  | The repository invented a private mechanism (`deps.shared.json` + `sync-deps.ts`) for a problem bun already solves with catalogs                                                 | S2, S11 | yes      |
| G6  | The four-day release-age policy is declared twice: `bunfig.toml` (`minimumReleaseAge`) and renovate's `stabilityDays`                                                            | S8      | reported |

## Tasks

| ID  | Description                                                                                                                                                            | Specs           | Commit  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------- |
| T1  | Root `package.json`: the `catalog` block with the currently compliant versions, and `"catalog:"` references from every workspace that declares them                    | S2, S5          | pending |
| T2  | `scripts/check-deps.ts`: three rules over the public CLI, read-only, one line per violation                                                                            | S3, S4          | pending |
| T3  | `scripts/__tests__/check-deps.test.ts`: a clean tree, a restated literal, cross-workspace drift, a stale catalog entry, the workspace protocol, a root with no catalog | S10             | pending |
| T4  | `Makefile`: `deps-check` runs the script; `deps-sync` removed                                                                                                          | S4              | pending |
| T5  | `expo-upgrade`: refuse a release age below the floor `bunfig.toml` declares instead of accepting `0`                                                                   | S8, G1          | 28a8d44 |
| T6  | `AGENTS.md` §10: the catalog, the three checks, the out-of-catalog packages and the SDK-matrix boundary                                                                | S7              | pending |
| T7  | Remove `deps.shared.json`, `scripts/sync-deps.ts` and their test; retract the false "no catalogs" claim from `AGENTS.md` and the PR body                               | S2, S4, S11, G5 | pending |
| T8  | Reconcile this document and the PR body with the catalog mechanism, and commit the rework                                                                              | S11             | pending |

## Log

- **L1** — User's original request, verbatim: "implementarlo en esta rama de forma completa, no importa los cambios hasta ahora y verificar si queda alguno otro hueco que no cumpla con la regla del @AGENTS.md"
- **L2** — Branch decision: the session was on `main` when the request arrived. §9 forbids commits on `main`, and the user asked for an `AGENTS.md` compliance audit, so "esta rama" was read as "the current working tree" and work moved to `chore/deps-monorepo-source-of-truth`. Committing on `main` would violate the very rules the task audits.
- **L3** — Superseded. An experiment on `bun 1.3.14` with two declaration shapes (`catalog` at the root and nested under `workspaces`) printed `is-number@catalog: failed to resolve`, and that was read as "bun catalogs do not exist". Both `deps.shared.json` and `AGENTS.md` §10's "No catalogs" paragraph were built on that reading. See L4.
- **L4** — User's correction, verbatim: "espera el deps.shared.json es una solucion custom no es ningun estandar ya reuelto para este problema?" The question is right and it overturns L3: the failure was a malformed specifier, not a missing feature. `catalog` at the root of `package.json`, `"catalog:"` in the workspaces, `bun install --frozen-lockfile` clean over 2108 installs. The custom file is replaced by the standard mechanism, and the retraction is recorded in S11.
- **L5** — `catalog` is a default, not a rule: bun installs a literal version a workspace writes even for a cataloged package, and the catalog cannot cover SDK-managed packages without fighting `expo install --check`. So `scripts/check-deps.ts` keeps exactly the three checks the catalog does not perform, and the SDK-managed family stays out of the catalog on purpose (S2, S3, S6).
- **L6** — Evidence for the rework: `bun scripts/check-deps.ts` → `check-deps: every workspace agrees with the root catalog` (exit 0); `bun test scripts/__tests__/check-deps.test.ts` → 6 pass / 0 fail, 16 assertions; `bun install --frozen-lockfile` → no changes; `bunx tsc --project scripts/tsconfig.json --noEmit` → clean. Root `scripts/` has no ESLint config (lint runs per workspace), so the type-check is the static gate there.
- **L7** — The catalog broke the repository's own lint gate: `package-json-dependencies/controlled-versions` demands a fixed version for every dependency, and on `"catalog:"` its fixer throws `tag 'catalog:' not found for package '@types/node'`, so `make lint` exited 2 and the pre-commit hook refused the commit. The plugin is at its latest release (1.0.20, April 2024) and has no catalog support, and its only escape hatch, `excludePatterns`, matches dependency names. Each workspace config now derives those names from the root catalog with `Object.keys(require('../../package.json').catalog ?? {})`, so there is no second list to maintain, `make deps-check` still holds the reference, and the exact-pin rule keeps covering every package the catalog does not name. `make lint` is green across the four workspaces.
