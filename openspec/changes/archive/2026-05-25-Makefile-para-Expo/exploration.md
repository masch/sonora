## Exploration: Makefile para Expo

### Current State

The project is **sonora**, an Expo SDK 56 universal app (iOS, Android, Web) using **Bun 1.3.3** as package manager, TypeScript 6.0 (strict), and Expo Router for file-based routing.

**Existing scripts in `package.json`:**
| Script | Command |
|--------|---------|
| `start` | `expo start` |
| `android` | `expo start --android` |
| `ios` | `expo start --ios` |
| `web` | `expo start --web` |
| `lint` | `expo lint` |
| `reset-project` | `node ./scripts/reset-project.js` |

**No Makefile exists.** No CI configuration exists (no `.github/workflows/`). No test runner is configured (`openspec/config.yaml` shows `testing.runner: none`).

**`.engram/config.json`** defines `"test_command": "make validate"` — meaning the `validate` target must be defined in the Makefile. The `validate` target is referenced but does not exist yet.

**OpenSpec testing config:**

- Linter: `expo lint`
- Type checker: `tsc --noEmit`
- Test runner: `none` (no unit/integration/e2e tests; available: `bun test`)
- No formatter configured

### Affected Areas

- `Makefile` (new) — root-level make targets for dev workflow
- `package.json` — scripts may be simplified if Makefile takes over
- `.engram/config.json` — already references `make validate`, so consistent

### Approaches

1. **Minimal wrapper over npm scripts** — `make dev-web`, `make dev-android`, etc. just delegate to `bun run <script>`
   - Pros: Zero maintenance, follows package.json as source of truth
   - Cons: Little added value; users still need to know package.json scripts
   - Effort: Low

2. **Direct `npx expo` targets** — bypass package.json scripts entirely
   - Pros: Self-documenting Makefile, no indirection
   - Cons: Duplicates package.json scripts (creates drift risk)
   - Effort: Low

3. **Smart DX Makefile** — thin wrappers + `validate` (lint + typecheck), `install`, `clean`, `help`, `reset`
   - Pros: Standard entry point for any contributor; `make validate` matches engram config; useful DX shortcuts (clean, reset, help)
   - Cons: Slightly more to maintain; some may argue "just use npm scripts"
   - Effort: Low

### Recommendation

**Approach 3: Smart DX Makefile.**

Rationale:

- `.engram/config.json` already commits to `make validate` — the Makefile is expected.
- `validate` should run `make lint && make typecheck` (lint + TypeScript check) since there's no test runner yet.
- `make install` (`bun install`) and `make clean` are universal conventions.
- `make help` avoids needing to read the Makefile.
- Targets delegate to `bun run <script>` for existing scripts; `typecheck` uses `tsc --noEmit` directly (not in package.json).
- Prepares a `test` target with a placeholder for when tests are added.

**Target proposal:**

| Target        | Command                                    | Notes                                |
| ------------- | ------------------------------------------ | ------------------------------------ |
| `start`       | `bun run start`                            | Default `make` target (first target) |
| `dev-web`     | `bun run web`                              | Launch web                           |
| `dev-android` | `bun run android`                          | Launch Android                       |
| `dev-ios`     | `bun run ios`                              | Launch iOS                           |
| `install`     | `bun install`                              | Install dependencies                 |
| `lint`        | `bun run lint`                             | ESLint via expo lint                 |
| `typecheck`   | `tsc --noEmit`                             | TypeScript check                     |
| `validate`    | `make lint && make typecheck`              | CI gate                              |
| `test`        | `bun test`                                 | Placeholder for future tests         |
| `clean`       | `rm -rf node_modules .expo web-build dist` | Deep clean                           |
| `reset`       | `make clean && make install`               | Full reset                           |
| `help`        | Lists all targets                          | Self-documenting                     |

### Risks

- **`expo lint` is not yet in the project**: `bun run lint` may fail until Expo's ESLint config is set up. The target should still exist but won't pass until configured.
- **`tsc --noEmit` may require tsconfig adjustments**: TypeScript 6.0 strict may have stricter checks. This should be validated early.
- **No tests exist yet**: `test` target is a placeholder. If someone runs `make test` it will error until a test framework is installed.
- **Bun vs Node**: Makefile must use `bun` consistently, not `npm` or `npx` (except `npx expo` if preferred, but `bun run` handles this).

### Ready for Proposal

**Yes** — the scope is clear and well-bounded. The Makefile is a simple DX improvement with no architectural risk. Move to `sdd-propose`.
