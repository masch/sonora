# Tasks: CI OpenSpec Archived Verification

- [x] Create verification script `scripts/verify-openspec-archived.ts`
- [x] Add `verify-openspec` target to `Makefile`
- [x] Integrate `make verify-openspec` into `.github/workflows/ci-pr.yml`
- [x] Clean up / archive old completed changes (`fix-android-mercadopago-redirect`, `test-gentle-review`)
- [x] Run `make verify-openspec` and `make scripts-typecheck` to confirm all pass
