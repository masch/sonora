# Tasks: Fix CI Security Audit Vulnerabilities

- [x] **Task 1**: Update root `package.json` with `overrides` and `resolutions` for `lodash@4.18.1`, `sharp@0.35.3`, and `undici@7.29.0`.
- [x] **Task 2**: Run `bun install` to regenerate lockfile and verify `bun audit` outputs.
- [x] **Task 3**: Update `.github/workflows/security-audit.yml` to support explicit unpatchable upstream advisory allowlist.
- [x] **Task 4**: Run full validation gate via `make validate`.
