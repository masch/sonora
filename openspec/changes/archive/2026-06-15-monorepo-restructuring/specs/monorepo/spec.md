# Specification: Monorepo Restructuring & Workspace Isolation

This specification details the technical requirements and migration steps for restructuring the Sonora codebase into a Bun-managed monorepo.

## 1. Directory Structure & Relocation Map

We will use `git mv` to preserve commit history.

| Original File/Directory  | Target Location                   |
| ------------------------ | --------------------------------- |
| `src/` (Expo App source) | `apps/mobile/src/`                |
| `assets/`                | `apps/mobile/assets/`             |
| `app.config.ts`          | `apps/mobile/app.config.ts`       |
| `tsconfig.json`          | `apps/mobile/tsconfig.json`       |
| `package.json`           | `apps/mobile/package.json`        |
| `metro.config.js`        | `apps/mobile/metro.config.js`     |
| `eas.json`               | `apps/mobile/eas.json`            |
| `doctor.config.ts`       | `apps/mobile/doctor.config.ts`    |
| `nativewind-env.d.ts`    | `apps/mobile/nativewind-env.d.ts` |
| `expo-env.d.ts`          | `apps/mobile/expo-env.d.ts`       |
| `jest.setup.ts`          | `apps/mobile/jest.setup.ts`       |
| `postcss.config.mjs`     | `apps/mobile/postcss.config.mjs`  |
| `api/`                   | `apps/api/`                       |

---

## 2. Workspace Package Configurations

### Root `package.json`

The root `package.json` will manage global devDependencies (like `prettier`, global linters) and define the workspaces:

```json
{
  "name": "sonora-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "prettier": "^3.0.0"
  }
}
```

### `apps/mobile/package.json`

- Change the name to `"name": "@sonora/mobile"`.
- Add dependency on `@sonora/shared`:
  ```json
  "dependencies": {
    "@sonora/shared": "workspace:*"
  }
  ```

### `apps/api/package.json`

- Change the name to `"name": "@sonora/api"`.
- Add dependency on `@sonora/shared`:
  ```json
  "dependencies": {
    "@sonora/shared": "workspace:*"
  }
  ```

### `packages/shared/package.json`

A new lightweight workspace containing shared typescript typings:

```json
{
  "name": "@sonora/shared",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "zod": "^3.0.0"
  }
}
```

---

## 3. Tooling and Configuration Adjustments

### Metro Config (`apps/mobile/metro.config.js`)

To support monorepo workspace resolution, the Metro config must find node_modules in the root folder:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

_No EAS config changes needed — all Makefile EAS targets already run via `cd apps/mobile && ...`, so EAS auto-detects the app context without a `cli.appDirectory` setting._

---

## 4. CI/CD GitHub Workflows

We must update the triggers and paths in the workflows to match the new workspace structure.

### `deploy-api-production.yml` & `deploy-api-staging.yml`

- **Path Triggers**: Change path triggers from `api/**` to `apps/api/**`.
  ```yaml
  on:
    push:
      paths:
        - 'apps/api/**'
        - 'packages/shared/**'
  ```
- **Checkout**: Full checkout `actions/checkout@v4` without sparse-checkout — more robust and avoids missing build-time dependencies. The root `tsconfig.json` no longer exists (moved to `apps/mobile/tsconfig.json`), so no delete step is needed.
- **API commands**: Update command execution inside the workflow to delegate correctly using `bun --filter @sonora/api`.

### `pr.yml`

- **Root Checks**: Runs `make check` which is refactored to check the entire monorepo workspaces using `bun --filter "*"`.
- **Paths**: Runs for all pull requests. No sparse-checkout changes needed.

### `deploy.yml` (App Deployment)

- **Path Ignore**: Ignore changes to `apps/api/**`, `openspec/**` and docs.
- **EAS / Firebase Build Steps**: Run build steps within `apps/mobile/` working directory:
  ```yaml
  - name: Build Android Preview APK
    run: cd apps/mobile && make eas-build-android-preview-local
  ```

### `socket.yml`

- **Dependency Paths**: Scan dependency lockfiles across the monorepo root.
