# Technical Design: Monorepo Restructuring

This design details the compilation pipeline, TypeScript configurations, Makefile adjustments, and CI/CD changes needed to support the monorepo architecture.

## 1. TypeScript Project References

To ensure fast typechecking and clean boundaries, we will design `@sonora/shared` to be imported directly by both the API and the mobile app via Bun workspaces.

### `packages/shared/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"]
}
```

### `apps/mobile/tsconfig.json` & `apps/api/tsconfig.json`

We will add path mappings and project references if necessary, or let Bun's workspace symlinking resolve the packages from `@sonora/shared` naturally.

---

## 2. Makefile Command Delegation (`bun --filter`)

The root `Makefile` will be completely refactored. Instead of changing directories manually (`cd api && ...`), it will use Bun's filter option to run scripts directly:

```makefile
# Old structure:
# test-front:
# 	bunx jest
# test-back:
# 	cd api && bun run test

# Refactored structure:
.PHONY: test-front test-back test
test-front:
	bun --filter mobile run test
test-back:
	bun --filter api run test
test:
	bun --filter "*" run test
```

We will apply this `bun --filter` pattern to:

- `start`, `dev-web`, `dev-android`, `dev-ios` -> `bun --filter mobile ...`
- `lint` -> `bun --filter "*" run lint`
- `format` -> `bun --filter "*" run format`
- `typecheck` -> `bun --filter "*" run typecheck`

---

## 3. CI/CD Workflow Path Adjustments

All GitHub action workflows must be updated to target the new workspace paths:

### `pr.yml` & `deploy.yml`

Update workspace paths and commands:

- Old checkouts did a full repository clone and ran `make check`. `make check` will now run `bun --filter "*" check` via the root Makefile, so the runner remains extremely clean.
- EAS deployment steps in `deploy.yml` must execute inside the `apps/mobile` directory:
  ```yaml
  - name: Build Android Preview APK
    run: cd apps/mobile && make eas-build-android-preview-local
  ```

---

## 4. Shared Package Schema: Feedback Entity

We will create the first shared entity inside `packages/shared/src/feedback.ts`:

- Define `Feedback` TypeScript interface.
- Define a Zod schema `FeedbackSchema` for payload validation.
- Export both via `packages/shared/src/index.ts`.
