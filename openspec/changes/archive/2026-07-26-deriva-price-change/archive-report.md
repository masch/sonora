# Archive Report: Deriva del Bosque al Río — Price Change

**Status**: ARCHIVED ✅

**Change**: `deriva-price-change`
**Archive date**: 2026-07-20
**Branch**: `feat/instructions-as-trip`

---

## Summary

Permanent price change of the "Deriva del Bosque al Río" experience (slug `umepay-bosque`, id `a23baa7e-2c82-472f-9241-4f23e00c1732`) from **15,000 ARS** (1,500,000 cents) to **1 ARS** (100 cents). Data-only change affecting 2 files.

## Artifacts

| Artifact      | Path                                                                    | Status                                     |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| Proposal      | `openspec/changes/deriva-price-change/proposal.md`                      | ✅ Complete                                |
| Spec          | `openspec/changes/deriva-price-change/specs/experience-pricing/spec.md` | ✅ Complete (incl. MP commission analysis) |
| Design        | `openspec/changes/deriva-price-change/design.md`                        | ✅ Complete                                |
| Tasks         | `openspec/changes/deriva-price-change/tasks.md`                         | ✅ All tasks completed                     |
| Verify Report | `openspec/changes/deriva-price-change/verify-report.md`                 | ✅ PASS — 6/6 requirements                 |

## Files Changed

| File                                                       | Change                          |
| ---------------------------------------------------------- | ------------------------------- |
| `apps/api/src/db/seed.ts`                                  | `price: 1500000` → `price: 100` |
| `apps/mobile/src/__tests__/use-instructions-audio.test.ts` | `price: 1500000` → `price: 100` |

## Test Results

| Suite             | Result                                                            |
| ----------------- | ----------------------------------------------------------------- |
| API (vitest)      | 182/182 pass ✅                                                   |
| Mobile (bun test) | formatPrice passes; pre-existing Bun/RN incompatibility unrelated |

## Remaining Actions (user)

1. **Manual SQL on production DB**:

   ```sql
   UPDATE experiences SET price = 100 WHERE id = 'a23baa7e-2c82-472f-9241-4f23e00c1732';
   ```

2. Deploy API to push seed change (affects fresh/rebuild environments)
3. Merge branch to main via PR
