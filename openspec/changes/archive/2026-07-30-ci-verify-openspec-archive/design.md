# Design: CI OpenSpec Archived Verification

## Architecture Overview

```
[GitHub Actions (ci-pr.yml)]
       │
       ▼
   [Makefile: verify-openspec]
       │
       ▼
 [bun run scripts/verify-openspec-archived.ts]
       │
       ├── Reads openspec/changes/
       ├── Scans tasks.md files for unchecked items
       └── Fails with exit code 1 if unarchived completed changes exist
```

## Data & Logic Flow

1. `verify-openspec-archived.ts`:
   - Synchronously reads directories under `openspec/changes/`.
   - Ignores hidden folders or `archive/`.
   - Parses `tasks.md` to check if all `- [x]` items are completed.
   - Outputs clear error messages in console if unarchived completed changes are detected.

2. `Makefile`:
   - Declares `.PHONY: verify-openspec`.
   - Target runs `bun run scripts/verify-openspec-archived.ts`.

3. `.github/workflows/ci-pr.yml`:
   - Runs `make verify-openspec` as part of the `format` check job.
