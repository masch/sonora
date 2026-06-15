# Exploration: Monorepo Restructuring

We want to restructure the project into a proper monorepo layout where the `app` (Expo mobile app) and the `api` (Hono backend) are separated directly from the root of the project.

Currently:

- `api/` is a subdirectory containing the backend API.
- The root directory contains the Expo mobile app files (e.g., `src/`, `assets/`, `app.config.ts`, `metro.config.js`, `package.json`, `tsconfig.json`).
- Root `package.json` does not configure workspaces explicitly, but manages the dependencies of the mobile app directly.

## Proposed Layouts

### Option A: `apps/` Workspace Layout

```text
├── apps/
│   ├── mobile/  (contains the Expo app: src/, assets/, app.config.ts, tsconfig.json, package.json, etc.)
│   └── api/     (contains the Hono API: src/, tsconfig.json, package.json, wrangler.toml, etc.)
├── package.json (root workspace package.json)
├── bunfig.toml
└── Makefile
```

### Option B: Root-level `app/` and `api/` layout

```text
├── app/         (contains the Expo app: src/, assets/, app.config.ts, tsconfig.json, package.json, etc.)
├── api/         (contains the Hono API: src/, tsconfig.json, package.json, wrangler.toml, etc.)
├── package.json (root workspace package.json)
├── bunfig.toml
└── Makefile
```

## Comparison of Tradeoffs

| Feature                        | Option A (`apps/` layout)                                                                                     | Option B (Root-level `app/` & `api/`)                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Workspace Convention**       | Follows industry standard monorepo layouts (like Turbo/Yarn workspaces).                                      | Simpler folder structure, less nesting.                      |
| **Expo Tooling Compatibility** | Expo CLI, EAS CLI, and metro bundler need configuration changes to handle being nested inside `apps/mobile/`. | Easier path resolution but still requires workspaces config. |
| **CI/CD configuration**        | Paths are highly organized under `apps/*`.                                                                    | Simpler workflow path matches.                               |
| **Workspaces Config (Bun)**    | `"workspaces": ["apps/*"]`                                                                                    | `"workspaces": ["app", "api"]`                               |

## Impact on Tooling

1. **Bun Workspaces**: We need a root `package.json` with `"workspaces"` configured to link dependencies across projects.
2. **Metro Config**: Expo's Metro bundler needs to be aware of the workspace root to resolve packages from the shared `node_modules` at the root. We must update `metro.config.js` to enable workspace resolution.
3. **EAS Build**: EAS CLI builds in the cloud. It needs to know the path of the app project. We must configure `"cli": { "appDirectory": "apps/mobile" }` (or similar) in `eas.json`.
4. **Makefile**: All Makefile targets need to be updated to delegate commands to the appropriate workspace using `bun --filter` or by changing directories.
5. **GitHub Workflows**: Path patterns (e.g., `api/**`) and execution directories need to be updated.

---

## Next Steps

1. Create a proposal detailing the chosen layout (we recommend Option A for standard monorepo layouts, or Option B if the user prefers minimal nesting).
2. Gather feedback on the proposed layout and directory names.
