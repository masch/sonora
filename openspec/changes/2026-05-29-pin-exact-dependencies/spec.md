# Specification: Pin Exact Dependency Versions

## Requirements

- **R1: Strict Exact Matching**
  All entries in the `dependencies` block of `package.json` must be pinned to exact versions, with all `~` and `^` prefixes removed.
  
- **R2: Strict Dev-Dependencies Matching**
  All entries in the `devDependencies` block of `package.json` must be pinned to exact versions, with all `~` and `^` prefixes removed.
  
- **R3: Lockfile Parity**
  The pinned versions must exactly match the versions currently resolved and locked in `bun.lock` (or currently active in `node_modules`).

- **R4: Validation Gate**
  The project must pass type checking (`npx tsc --noEmit`) and testing (`npx jest --watchAll=false`) with zero failures.
