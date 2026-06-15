# Design: Pin lightningcss to 1.30.1

## Architecture

We move the `lightningcss` override from package-level overrides in `apps/mobile/package.json` to workspace-level overrides in the root `package.json` so that Bun workspace monorepo respects the override globally.

## Components

- Root `package.json`: Configure `"overrides": { "lightningcss": "1.30.1" }`
- `apps/mobile/package.json`: Remove `"overrides"` block
- `bun.lock`: Regenerated lockfile resolving all transitive and direct `lightningcss` resolutions to `1.30.1`.
