# Tasks: Pin lightningcss to 1.30.1

- [x] Pin `lightningcss` to `1.30.1` at the root `package.json`
- [x] Remove package-level `overrides` from `apps/mobile/package.json`
- [x] Regenerate `bun.lock` using `bun install --minimum-release-age=0`
- [x] Verify `bun.lock` contents to ensure all `lightningcss` instances resolve to `1.30.1`
- [x] Run validation checks (`make check` / `make validate`) to verify compilation and test suite passing
