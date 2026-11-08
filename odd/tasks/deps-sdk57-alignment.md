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

| ID  | Description                                                                                                                                                                        | Specs          | Route  | Commit                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------ | -------------------------------------------------------------------- |
| T1  | Structural consistency: dynamic Expo package selection in the `Makefile` fallback, drop ignored `resolutions` blocks, deduplicate the `lightningcss` override, unify `@types/node` | S1, S2         | inline | `chore(deps): derive expo package list and drop ignored resolutions` |
| T2  | Patch alignment inside SDK 57 across `apps/mobile`, `apps/admin`, `apps/api`, `packages/shared` and the root                                                                       | S2, S3, S4, S7 | inline | `chore(deps): align expo sdk 57 patches and safe bumps`              |
| T3  | Regenerate `bun.lock` and confirm resolution                                                                                                                                       | S3             | inline | folded into T2                                                       |
| T4  | Full verification gate                                                                                                                                                             | S6             | inline | none (evidence only)                                                 |

## Log

- **L1** — User's original request, verbatim: "quiera antes ver las inconsitencia que encontramos, quiero actualizar a nivel repo general todos"
- **L2** — Scope decision: after the inventory was presented, the user selected "Olas 0+1: consistencia y patches del SDK 57 (recomendado)".
- **L3** — Correction of an orchestrator error: the `*` marker in `bun outdated` means the displayed `Latest` is already capped by `minimumReleaseAge`, so those versions are installable. `tailwindcss` and `@tailwindcss/postcss` 4.3.4 therefore belong in wave 1.
