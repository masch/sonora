# Tasks: Monorepo Restructuring

This is the task checklist for migrating the Sonora codebase to a Bun workspaces monorepo.

## Phase 1: Workspace Setup & Relocation

- [x] Create workspace directories (`apps/`, `packages/`)
- [x] Initialize root `package.json` with workspace definition
- [x] Move Expo app files using `git mv` (to preserve history)
  - [x] Move `src/` to `apps/mobile/src/`
  - [x] Move `assets/` to `apps/mobile/assets/`
  - [x] Move configuration files (`app.config.ts`, `metro.config.js`, `tsconfig.json`, `package.json`, `eas.json`, `postcss.config.mjs`, `jest.setup.ts`, `doctor.config.ts`) to `apps/mobile/`
- [x] Move API files using `git mv`
  - [x] Move `api/` to `apps/api/`

## Phase 2: Shared Library Initialization

- [x] Create `packages/shared/` directory structure
- [x] Create `packages/shared/package.json`
- [x] Create `packages/shared/tsconfig.json`
- [x] Define the shared `Feedback` entity and schema in `packages/shared/src/feedback.ts`
- [x] Export feedback entity in `packages/shared/src/index.ts`
- [x] Add `@sonora/shared` dependency to `apps/mobile/package.json` and `apps/api/package.json`

## Phase 3: Tooling Configurations

- [x] Update `apps/mobile/metro.config.js` to enable workspace resolution
- [x] Update root `Makefile` to use `bun --filter`
- [x] Update `.githooks/pre-commit` to use the new Makefile targets
- [x] Verify that `bun install` successfully links workspaces

## Phase 4: CI/CD Updates

- [x] Update `deploy-api-production.yml` with the new paths and sparse-checkout settings
- [x] Update `deploy-api-staging.yml` with the new paths and sparse-checkout settings
- [x] Update `deploy.yml` with the updated mobile directory target

## Phase 5: Verification & Testing

- [x] Run `make format` to verify formatting across workspaces
- [x] Run `make lint` to verify linting across workspaces
- [x] Run `make test` to verify unit tests pass
- [x] Run `make typecheck` to verify TypeScript compiler runs clean
