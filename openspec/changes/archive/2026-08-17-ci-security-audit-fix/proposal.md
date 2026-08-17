# Proposal: Fix CI Security Audit Vulnerabilities

## 1. Problem Statement

The scheduled GitHub Actions `security-audit` workflow failed because `bun audit` detected 10 vulnerabilities (5 high, 5 moderate) across transitive dependencies (`lodash`, `image-size`, `sharp`, and `undici`). The CI security threshold is set to `moderate`, triggering an immediate failure.

## 2. Proposed Changes

- Investigate safe version overrides/resolutions or workspace dependency updates for:
  - `lodash` (target patched version >= 4.17.23 / fixed release or replacement)
  - `image-size` (target patched version > 2.0.2 if available, or override)
  - `sharp` (target >= 0.35.0)
  - `undici` (target >= 7.29.0)
- Add package overrides/resolutions in root `package.json` while respecting `bunfig.toml`'s `minimumReleaseAge` policy.
- Validate with `bun audit` and `make validate` to guarantee no regressions or breaking changes across workspaces (`@sonora/mobile`, `@sonora/admin`, `@sonora/api`).

## 3. Impact & Risk Assessment

- **Risk Level**: Low-Medium (transitive dependency pinning).
- **Workspaces Affected**: Root, `@sonora/mobile`, `@sonora/admin`, `@sonora/api`.
- **Breaking Change Risk**: Low, provided overrides don't break sub-dependency contracts.

## 4. Verification Plan

- `bun audit` outputs 0 vulnerabilities at or above `moderate` severity.
- `make validate` passes all linting, typechecking, and test suites.
