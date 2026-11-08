# Tasks: Monorepo Dependency Source of Truth

**Feature**: `deps-monorepo-source-of-truth`
**Branch**: `chore/deps-monorepo-source-of-truth`
**Delivery Strategy**: `ask-on-risk`

## Specs

- **S1** — User's request, verbatim: "implementarlo en esta rama de forma completa, no importa los cambios hasta ahora y verificar si queda alguno otro hueco que no cumpla con la regla del @AGENTS.md"
- **S2** — The repository gains one declared source of truth for dependency versions that must be uniform across workspaces, at `deps.shared.json` in the root, with two sections: `shared` (a package name to exact version map that every workspace declaring that package must use verbatim) and `lockstep` (groups of packages that move together; updating one member alone is refused).
- **S3** — A script under `scripts/` validates the repository against that file and reports every violation with the workspace, package, declared value and expected value. Validation never mutates anything.
- **S4** — The same script can apply the declared versions to every workspace that declares them, but only when asked explicitly; the default invocation is a dry run, following the `db-migrate-*` convention already used in the `Makefile` (`LIVE=1` to execute).
- **S5** — `bun catalog:` is not available on bun 1.3.14 (verified: both the top-level and the `workspaces`-nested forms fail with `failed to resolve`). The design must not depend on it.
- **S6** — The mechanism must not override the Expo SDK matrix or `minimumReleaseAge`. `expo install --check` stays the authority for SDK-aligned native modules, and no path may reduce the release-age policy.
- **S7** — `AGENTS.md` §10 documents the new mechanism, because the repository requires docs to describe the behavior that ships with it.
- **S8** — Audit the repository for remaining gaps against `AGENTS.md` rules in the dependency and tooling area, and fix the ones that are in scope. At minimum the known one: the `expo-upgrade` target prompts for a release age of `0 = immediate`, which directly contradicts §10's "must NEVER ... reduce this value".
- **S9** — Git rules hold: no commits on `main`, work stays on `chore/deps-monorepo-source-of-truth`, no `--no-verify`, no `--amend`.
- **S10** — Tests follow the existing convention: `bun:test` inside `scripts/__tests__/`.

## Known gaps found during the audit

| #   | Gap                                                                                                                                                                              | Rules | In scope |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- |
| G1  | `make expo-upgrade` offers `0 = immediate` for the release age, contradicting §10                                                                                                | S8    | yes      |
| G2  | `scripts/pin-deps.ts` hardcodes `TARGET_FILES` to four manifests, so a new workspace is silently skipped (same class of bug as the hardcoded `Makefile` list fixed in `72224fe`) | S8    | reported |
| G3  | Nothing detects a declared dependency that no workspace imports; `test-renderer` is declared and unused                                                                          | S8    | reported |
| G4  | Five manifests pin their own versions with no cross-workspace check, which is how `@types/node` drifted to 26.1.0 at the root and 26.0.1 in `apps/api`                           | S2    | yes      |

## Tasks

| ID  | Description                                                                                                                        | Specs  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T1  | `deps.shared.json` with the `shared` map and the `lockstep` groups, describing the repository's current compliant state            | S2, S5 |
| T2  | `scripts/sync-deps.ts`: validate by default, apply only on explicit request, one clear error per violation                         | S3, S4 |
| T3  | `scripts/__tests__/sync-deps.test.ts`: a passing tree, a drifted version, an unknown package, and a lockstep subset update refusal | S10    |
| T4  | `Makefile`: `deps-check` (read-only) and `deps-sync` (dry run unless `LIVE=1`)                                                     | S4     |
| T5  | `expo-upgrade`: refuse a release age below the policy floor instead of accepting `0`                                               | S8, G1 |
| T6  | `AGENTS.md` §10: document the file, the commands and the SDK-matrix boundary                                                       | S7     |

## Log

- **L1** — User's original request, verbatim: "implementarlo en esta rama de forma completa, no importa los cambios hasta ahora y verificar si queda alguno otro hueco que no cumpla con la regla del @AGENTS.md"
- **L2** — Branch decision: the session was on `main` when the request arrived. §9 forbids commits on `main`, and the user asked for an `AGENTS.md` compliance audit, so "esta rama" was read as "the current working tree" and work moved to `chore/deps-monorepo-source-of-truth`. Committing on `main` would violate the very rules the task audits.
- **L3** — `bun catalogs` rejected after an empirical test on bun 1.3.14, both declaration shapes: `is-number@catalog: failed to resolve`. The earlier proposal leaned on catalogs; that path is closed.
