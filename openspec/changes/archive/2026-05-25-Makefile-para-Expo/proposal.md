# Proposal: Makefile-para-Expo

## Intent

Provide a standard Makefile entry point for common dev tasks (start, lint, typecheck, validate, install, clean, reset) so contributors have a single, discoverable interface regardless of package manager knowledge. `.engram/config.json` already references `make validate` — this makes it real.

## Scope

### In Scope

- Root `Makefile` with 13 targets: `start`, `dev-web`, `dev-android`, `dev-ios`, `doctor`, `install`, `lint`, `typecheck`, `validate`, `test`, `clean`, `reset`, `help`
- `start` as the default target (first target in file)
- `validate` includes `test` + `lint` + `typecheck` (CI gate matching engram config)
- All targets delegate to `bun` (consistent with project package manager)
- Install `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native`
- Configure Jest preset, tsconfig types, test script, and transformIgnorePatterns
- `test` target runs `jest` (real, not placeholder)
- Update `package.json` with Jest config and test script
- Update `tsconfig.json` with Jest types
- Update `openspec/config.yaml` with real test runner info

### Out of Scope

- CI/CD pipeline (CI will use `make` but is out of scope here)
- Writing actual test files (just the infra to run them)
- Formatter setup (not configured in this project yet)
- E2E tests or Maestro setup
- Docker-based build tooling

## Capabilities

### New Capabilities

None — this is a pure tooling/config change with no spec-level behavior.

### Modified Capabilities

None — no existing specs are affected.

## Approach

**Smart DX Makefile + TDD infra** (expanded from exploration approach 3):

**Makefile:**

- Thin wrappers delegating to `bun run <script>` for existing scripts
- `typecheck` and `validate` add functionality not in package.json
- `validate` = `make test && make lint && make typecheck` (tests first, per TDD)
- Auto-generated `help` target via `@grep -E '^[a-zA-Z_-]+:' Makefile
- Targets ordered: convenience (start, dev-\*) → utilities (install, lint, typecheck) → test → CI (validate) → maintenance (clean, reset)
- Standard phony declarations for all targets

**Test runner setup:**

- Install `jest-expo`, `jest`, `@types/jest` via `bunx expo install --dev`
- Install `@testing-library/react-native` via `bunx expo install --dev`
- Add `jest` preset to `package.json`
- Add `"types": ["jest"]` to `tsconfig.json`
- Add `"test": "jest --watchAll"` script to `package.json`
- Configure `transformIgnorePatterns` in `package.json` jest config
- Update `openspec/config.yaml` testing section with the real runner

## Affected Areas

| Area                   | Impact    | Description                                                         |
| ---------------------- | --------- | ------------------------------------------------------------------- |
| `Makefile`             | New       | Root-level make targets for dev workflow                            |
| `package.json`         | Modified  | Add Jest config (preset, transformIgnorePatterns) and `test` script |
| `tsconfig.json`        | Modified  | Add `"types": ["jest"]`                                             |
| `openspec/config.yaml` | Modified  | Update testing section with real runner                             |
| `.engram/config.json`  | Unchanged | Already references `make validate` — no update needed               |

## Risks

| Risk                                                                        | Likelihood | Mitigation                                                   |
| --------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| `expo lint` not yet configured                                              | Low        | Target exists, fails gracefully; configure ESLint separately |
| `tsc --noEmit` surfaces existing errors                                     | Med        | Run once after creation; fix or document known issues        |
| Jest config may need tweaks for Expo SDK 56                                 | Low        | Follow official jest-expo preset; test after install         |
| `@testing-library/react-native` may not work with React 19.2 without config | Low        | Already compatible per Expo docs                             |
| Bun + Jest compatibility                                                    | Low        | jest-expo uses Jest, works with bun as package manager       |

## Rollback Plan

Delete `Makefile` from project root. No other files are modified. All functionality falls back to `bun run <script>` as before.

## Dependencies

- Bun (already installed)
- TypeScript 6.0 (already installed)
- `expo-doctor` for `doctor` target (resolved via `bunx`)

## Success Criteria

- [ ] `make` (default = start) launches Expo dev server
- [ ] `make lint` runs expo lint
- [ ] `make typecheck` runs `tsc --noEmit` without errors
- [ ] `make test` runs Jest with the jest-expo preset
- [ ] `make validate` runs test → lint → typecheck in sequence
- [ ] `make install` runs `bun install`
- [ ] `make clean` removes node_modules and build artifacts
- [ ] `make reset` cleans and reinstalls
- [ ] `make doctor` runs expo-doctor without errors
- [ ] `make help` lists all targets
- [ ] `jest-expo` and `@testing-library/react-native` are installed as dev deps
- [ ] `openspec/config.yaml` reflects the real test runner
