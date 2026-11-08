# Tasks: Dependency Alignment within Expo SDK 57

**Feature**: `deps-sdk57-alignment`
**Branch**: `chore/deps-sdk57-alignment`
**Delivery Strategy**: `ask-on-risk`

## Specs

- **S1** — Scope requested by the user: "quiera antes ver las inconsitencia que encontramos, quiero actualizar a nivel repo general todos". Repository-wide dependency update, preceded by a visible inventory of the inconsistencies.
- **S2** — Delivered scope is waves 0 and 1 only: structural consistency plus patch alignment inside the installed Expo SDK 57. Explicitly out of scope: Expo SDK 58, `react-native` 0.88, `react` 19.3, TypeScript 7, ESLint 10, Jest 30, Vitest 5, `firebase` 13, `@react-native-firebase/*` 27, `react-native-webview` 14, `@babel/runtime` 8, `@cloudflare/workers-types` 5, `react-native-gesture-handler` 3, and `wrangler` (its 51-minor jump is deploy tooling and needs its own verification).
- **S3** — `minimumReleaseAge = 345600` (4 days) in `bunfig.toml` is a hard policy: never commented out, bypassed, or reduced. A package whose needed version is newer than that is reported, never forced.
- **S4** — The Expo SDK matrix is the authority for native module versions, not the registry latest. `expo install --check` decides what "up to date" means for `expo-*` packages; `bun outdated` is used for everything else.
- **S5** — Git rules hold: no commits on `main`, work stays on `chore/deps-sdk57-alignment`, no `--no-verify`, no `--amend` on shared branches. The pre-existing uncommitted `apps/mobile/app.config.ts` change belongs to other work and is neither staged nor modified.
- **S6** — Gate for "done": `make expo-doctor` shows no new failure versus the pre-change baseline, `typecheck`, `lint` and tests are green in every workspace, and `make verify-web` produces a loadable bundle.
- **S7** — `bunfig.toml` sets `exact = true`, so every version written is an exact pin with no `^` or `~`.

## Baseline (before any change)

- `expo install --check` in `apps/mobile`: 10 packages behind within SDK 57.
- `expo install --check` in `apps/admin`: 3 packages behind within SDK 57.
- `bun outdated --recursive`: 68 outdated entries across 5 workspaces.
- Structural inconsistencies: `@types/node` drift (root 26.1.0 vs api 26.0.1); duplicated and ignored `resolutions` blocks; `lightningcss` pinned in four places; hardcoded 7-package fallback list in `Makefile:184-187`.

## Tasks

| ID  | Description                                                                                                                                                                        | Specs          | Route  | Commit                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ------------------------- |
| T1  | Structural consistency: dynamic Expo package selection in the `Makefile` fallback, drop ignored `resolutions` blocks, deduplicate the `lightningcss` override, unify `@types/node` | S1, S2         | inline | `72224fe`, `e5c08bd`      |
| T2  | Bumps that resolve under SDK 57 and the release-age policy: 17 non-Expo packages across `apps/api`, `apps/admin`, `apps/mobile`, `packages/shared` and the root                    | S2, S3, S4, S7 | inline | `e5c08bd`                 |
| T3  | Regenerate `bun.lock` and confirm each resolved version in `node_modules`                                                                                                          | S3             | inline | folded into `e5c08bd`     |
| T4  | Verification gate                                                                                                                                                                  | S6             | inline | no commit, evidence below |
| T5  | Expo SDK 57 patch line, 13 packages                                                                                                                                                | S4             | —      | deferred, see L4          |

## Verification evidence (T4)

- `bun install` → rc 0, no peer warnings once `test-renderer` was reverted.
- `apps/api`: typecheck, lint, `vitest run` → rc 0.
- `packages/shared`: lint, `vitest run` → rc 0.
- `apps/mobile`: typecheck, lint, `jest` → rc 0.
- `apps/admin`: typecheck, lint, `jest` → rc 0.
- `make verify-web` → rc 0; the exported web bundle is re-required by node and loads cleanly.
- `bunx expo-doctor` in `apps/mobile` and `apps/admin` → 20/21. The single failing check is the SDK version matrix, accounted for entirely by the deferred Expo patches (T5/L4) plus the two reverts recorded in L5.
- Pre-commit hooks on both commits: format-check, test-ci, lint, typecheck, doctor-ci, expo-doctor (non-blocking), gga → all passed.

## Log

- **L1** — User's original request, verbatim: "quiera antes ver las inconsitencia que encontramos, quiero actualizar a nivel repo general todos"
- **L2** — Scope decision: after the inventory was presented, the user selected "Olas 0+1: consistencia y patches del SDK 57 (recomendado)".
- **L3** — Correction of an orchestrator error: the `*` marker in `bun outdated` means the displayed `Latest` is already capped by `minimumReleaseAge`, so those versions are installable. `tailwindcss` and `@tailwindcss/postcss` 4.3.4 therefore belong in wave 1.
- **L4** — The whole Expo SDK 57 patch line is blocked, not a single package. `bun install` refused `expo@57.0.32`, `expo-asset@57.0.21`, `expo-background-fetch@57.0.22`, `expo-build-properties@57.0.23`, `expo-constants@57.0.23`, `expo-glass-effect@57.0.5`, `expo-location@57.0.23`, `expo-router@57.0.30`, `expo-splash-screen@57.0.11` and `expo-task-manager@57.0.22` with `blocked by minimum-release-age: 345600 seconds`. Registry publish times are all 2026-11-05 around 09:30, so they unlock roughly one day later. The policy is not touched; those packages stay at their current versions and T5 carries them forward.
- **L5** — Two bumps were self-inflicted regressions and were reverted, not worked around: `@types/react@19.3.0` (expo-doctor reports the SDK expects `~19.2.4`) and `test-renderer@1.3.1` (pulls `react-reconciler@~0.34.0`, which peers `react ^19.3.0` against the installed `react@19.2.3`). Note for later: neither `test-renderer` nor `react-test-renderer` is imported anywhere under `apps/mobile/src`, so `test-renderer` looks like an unused devDependency and a candidate for removal under its own change.
- **L6** — Waves 0 and 1 are complete with the verification evidence above. Wave 2 (SDK 58) and wave 3 (TypeScript 7, ESLint 10, Jest 30, Vitest 5, Firebase 13, React Native Firebase 27, react-native-webview 14, @babel/runtime 8, @cloudflare/workers-types 5, gesture-handler 3) remain out of scope per S2.
