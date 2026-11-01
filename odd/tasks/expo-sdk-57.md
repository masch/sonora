# Tasks: Expo SDK 56 → 57 Upgrade

**Feature**: `expo-sdk-57`
**Branch**: `chore/expo-sdk-57`
**Delivery Strategy**: `ask-on-risk`

## Specs

- **S1** — Update the mobile app to Expo SDK 57. User's words: "Actulizcemos a expo 57".
- **S2** — Treat the upgrade as a staged repair, not a single drop. User's words: "vamos hacer un cambio grande de base que tiene problemas, pero vamos a solucionar uno por uno" and "cuando lo hagamos van a saltar errores, vamos a ir viendolo para resolverlos". Every error that appears is diagnosed and fixed before moving to the next one.
- **S3** — Baseline first: `make expo-doctor` ("Primero ejecutemos make expo-doctor para evaluar el esfuerzo") records the pre-upgrade failure set so post-upgrade failures are attributable.
- **S4** — `bunfig.toml` `minimumReleaseAge = 345600` (4 days) is a hard policy: never commented out, bypassed, or reduced. If a required version is newer than 4 days, stop and ask.
- **S5** — Repository git rules hold: no commits on `main`, work on `chore/expo-sdk-57`, no `--no-verify`, no `--amend` on shared branches.
- **S6** — Target SDK 57 line is `expo@57.0.31` (RN 0.86.3), which is past the Hermes V1 regressions documented for SDK 56 and `expo < 57.0.17`.
- **S7** — Gate for "done": `make expo-doctor` shows no new failure versus the S3 baseline, plus `bun run typecheck`, `bun run lint` and `bun test` (jest) green in `apps/mobile`.

## Baseline (S3 evidence, SDK 56, before any change)

`make expo-doctor` → **20/22 checks passed, 2 failed**:

1. **Duplicate native module dependencies** — `@expo/ui`, `expo`, `expo-asset`, `expo-constants`, `expo-file-system`, `expo-font`, `expo-glass-effect`, `expo-linking`, `expo-symbols`, `@expo/dom-webview`, `@expo/log-box`. Bun workspace layout; the Makefile already documents this class as a known false positive (`EXPO_NO_DOCTOR` note, `check` target warns instead of failing).
2. **Hermes V1 memory regression** — `expo@56.0.24` / RN 0.85.3 ships Hermes V1 `250829098.0.10`; the fix lands in `250829098.0.16`. Doctor's own advice: upgrade to SDK 57 with `expo@57.0.9+` and RN `0.86.2+`.

Estimated effort surfaced by the baseline: the upgrade is the _fix_ for the only substantive failure, and Expo documents SDK 57 as a non-breaking RN 0.85 → 0.86 bump.

## Version delta (target: `bundledNativeModules.json` of `expo@57.0.31`)

| Package                                      | Now                | Target                     |
| -------------------------------------------- | ------------------ | -------------------------- |
| `expo`                                       | 56.0.24            | 57.0.31                    |
| `react-native`                               | 0.85.3             | 0.86.3                     |
| `react` / `react-dom`                        | 19.2.3             | 19.2.3 (unchanged)         |
| `expo-router`                                | 56.2.22            | ~57.0.29                   |
| `@expo/ui`                                   | 56.0.26            | ~57.0.26                   |
| `react-native-reanimated`                    | 4.3.1              | 4.5.1                      |
| `react-native-worklets`                      | 0.8.3              | 0.10.1                     |
| `react-native-gesture-handler`               | 2.31.2             | ~2.32.0                    |
| `react-native-screens` / `safe-area-context` | 4.26.0 / 5.7.0     | unchanged ranges           |
| `jest-expo`                                  | 56.0.6             | ~57.0.6                    |
| `eslint-config-expo`                         | 56.0.4             | ~57.0.2                    |
| `@react-native/jest-preset`                  | 0.85.3             | 0.86.3                     |
| all `expo-*` modules                         | 56.x               | 57.x per bundled modules   |
| `@react-native-firebase/*`                   | 21.14.0            | unchanged unless it breaks |
| `nativewind` / `react-native-css`            | 5.0.0-rc.0 / 3.0.7 | unchanged unless it breaks |

## Tasks

- [x] `T1` (S1, S6) — Repin `apps/mobile/package.json` to the SDK 57 line and install. Commit: `chore(mobile): upgrade Expo SDK 56 to 57`. 33 pins moved; `bun install` clean; `expo install --check` → "Dependencies are up to date".
- [x] `T2` (S2) — Drive `make expo-doctor` to the baseline set and record each remaining failure with its cause. Now 20/21 with only the bun-workspace duplicate check left (baseline item 1); the Hermes V1 check passes.
- [ ] `T3` (S2) — Resolve `bun run typecheck` errors introduced by the bump.
- [ ] `T4` (S2) — Resolve `bun run lint` errors introduced by the bump.
- [ ] `T5` (S2) — Resolve jest failures introduced by the bump.
- [x] `T6` (S7) — Run the full gate (doctor + typecheck + lint + test) and record the result. `make typecheck` (mobile/api/admin) 0, `make lint` (4 workspaces) 0, `make test-front` 123 suites / 1118 tests green, `make verify-web` builds and executes the web bundle, `make format-check` clean except the gitignored generated `public/maplibre-gl-worker.js` that predates this branch.
- [x] `T7` (S1) — Update `AGENTS.md` versioned-docs pointer from v56 to v57. Also `Makefile` header, `README.md` stack line and the `docs/payment_flow_architecture.md` diagram label; archived `openspec/changes/archive/**` left untouched as history.

## Log

- **L1** — User's original request, verbatim: "vamos hacer un cambio grande de base que tiene problemas, pero vamos a solucionar uno por uno. Actulizcemos a expo 57 y cuando lo hagamos van a saltar errores, vamos a ir viendolo para resolverlos. Primero ejecutemos make expo-doctor para evaluar el esfuerzo"
- **L2** — Baseline `make expo-doctor` on SDK 56 captured (see Baseline section): 20/22, 2 failures, one of them the Hermes V1 regression that SDK 57 fixes.
- **L3** — Branch `chore/expo-sdk-57` created from `main` at `e297771` before the first write (S5).
- **L4** — Checked release age: `expo@57.0.31` published 2026-10-21 (11 days old) → satisfies `minimumReleaseAge` (S4). `expo@58` is newer but out of the requested scope (S1).
- **L5** — Expo SDK 57 changelog (https://expo.dev/changelog/sdk-57): RN 0.85 → 0.86 intended non-breaking; RN 0.86.3 arrives with `expo@57.0.17`; `expo prebuild` now clears native dirs by default (irrelevant here, the project uses CNG without committed `ios/`/`android/`).
- **L6** — Resolution rule for the repin: `expo@57.0.31`'s `bundledNativeModules.json` range, newest release inside that range that is at least 4 days old. Third-party pins already satisfying their SDK 57 range (`react`, `react-dom`, `react-native-web`, `react-native-screens`, `react-native-safe-area-context`, `@expo/vector-icons`, `@react-native-community/netinfo`) were left alone to keep the diff honest. `@react-native-firebase/*` (21.14.0), `nativewind` (5.0.0-rc.0), `react-native-css` (3.0.7) and `maplibre-react-native` (11.5.0) were not forced; their peer ranges still admit RN 0.86 and nothing in the JS gate objected.
- **L7** — Post-bump `make expo-doctor`: 20/21, only the bun-workspace duplicate check remains (baseline item 1). The Hermes V1 check now passes, which was the substantive failure the baseline surfaced. `expo install --check` reports "Dependencies are up to date".
- **L8** — Zero code errors appeared from the bump: typecheck, lint, jest and the executed web bundle all green on the first run. What remains unproven is native compilation (new native module versions + RNFirebase 21.14.0 against RN 0.86) — that needs an EAS/dev build.
