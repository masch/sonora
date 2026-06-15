# Proposal: Monorepo Restructuring

We propose to restructure the Sonora project into a standardized monorepo using Bun Workspaces. This will isolate the mobile app from the backend API at the root level and provide a dedicated space for shared code.

## Goals

1. **Clean Root Directory**: Move all mobile app specific files out of the root directory.
2. **Strict Isolation**: Separate `apps/mobile` (Expo) and `apps/api` (Hono API) to prevent tooling conflicts (such as TypeScript, ESLint, and esbuild issues).
3. **Code Sharing Capabilities**: Introduce `packages/shared` to share types and validation schemas (e.g., the `feedback` entity) between front-end and back-end.
4. **Unified Task Running**: Refactor the root `Makefile` to use `bun --filter` to coordinate tasks across the workspaces from the root.

---

## Proposed Directory Structure

```text
├── apps/
│   ├── mobile/           # The Expo application (moved from root)
│   │   ├── src/
│   │   ├── assets/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── app.config.ts
│   └── api/              # The Hono API (moved from api/ in root)
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/           # Shared libraries (types, validation schemas)
│       ├── src/
│       │   └── index.ts  # Exports shared interfaces & schemas
│       ├── package.json
│       └── tsconfig.json
├── package.json          # Root workspace package.json
├── bunfig.toml           # Root Bun configuration
└── Makefile              # Root Makefile using bun --filter
```

---

## Proposed Changes

### 1. Root Configurations

- **`package.json`**:
  Configure Bun workspaces to include both `apps/*` and `packages/*`:
  ```json
  {
    "name": "sonora-monorepo",
    "private": true,
    "workspaces": ["apps/*", "packages/*"]
  }
  ```
- **`tsconfig.json`**:
  Root tsconfig will be a basic compiler config, while each workspace (mobile, api, shared) will have its own independent `tsconfig.json` extending root settings or configuring its own target environment.

### 2. Relocating Apps

- Move all Expo mobile app files into `apps/mobile/` using `git mv` to preserve commit history.
- Move the `api/` directory into `apps/api/` using `git mv`.

### 3. Adding Shared Workspace

- Initialize `packages/shared` containing shared TypeScript interfaces and Zod schemas (such as the `Feedback` schema/validation rules) which can be imported as dependencies:
  - `"@sonora/shared": "workspace:*"` inside `apps/mobile/package.json` and `apps/api/package.json`.

---

## Verification Plan

### Automated Checks

- Verify that `bun install` completes successfully at the root and correctly symlinks workspaces.
- Run tests in all workspaces: `bun --filter "*" test`.
- Run typechecks: `bun --filter "*" run typecheck`.
- Run linter: `bun --filter "*" run lint`.

### Manual Checks

- Verify that `make check` passes cleanly from the root using the refactored Makefile.
- Ensure the Expo dev server starts correctly inside `apps/mobile`.
