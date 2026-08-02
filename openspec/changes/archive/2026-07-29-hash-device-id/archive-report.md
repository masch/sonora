# Archive Report — hash-device-id

**Status**: **PASS** ✅
**Date**: 2026-07-29
**Archived at**: `openspec/changes/archive/2026-07-29-hash-device-id/`

## Executive Summary

Change `hash-device-id` is fully implemented, verified, and synced. All 3 PRs complete and merged to the `hash-device-id` tracker branch. PR #359 open from tracker to main. No CRITICAL issues, no blockers. 3 WARNINGs and 2 SUGGESTIONs from verification are documented spec deviations with no functional impact.

## Artifacts Read

| Artifact       | Topic Key                                        | Observation ID | Source                |
| -------------- | ------------------------------------------------ | -------------- | --------------------- |
| Proposal       | `sdd/hash-device-id/proposal`                    | 123            | Engram                |
| Spec           | `sdd/hash-device-id/spec`                        | 124            | Engram                |
| Design         | `sdd/hash-device-id/design`                      | 126            | Engram                |
| Tasks          | `sdd/hash-device-id/tasks`                       | 127            | Engram                |
| Apply Progress | `sdd/hash-device-id/apply-progress`              | 128            | Engram                |
| Verify Report  | `sdd/hash-device-id/verify-report`               | 130            | Engram                |
| Sync Report    | `openspec/changes/hash-device-id/sync-report.md` | —              | OpenSpec (filesystem) |
| Config         | `openspec/config.yaml`                           | —              | OpenSpec (filesystem) |

## Domains

### API — Synced to Canonical

**File**: `openspec/specs/api/spec.md`
**Operation**: Delta applied (archive-time sync fallback)

| Operation | Requirements                                      |
| --------- | ------------------------------------------------- |
| ADDED     | Device ID pass-through middleware                 |
| ADDED     | Device platform variable type                     |
| ADDED     | Device platform header injection in middleware    |
| ADDED     | Platform persistence in experience access logging |
| ADDED     | Platform persistence in purchase creation         |
| ADDED     | CORS support for `X-Device-Platform` header       |

### Device Identity — Engram Only

**File**: `openspec/specs/device-identity/spec.md` — NOT CREATED
Spec existed only in Engram memory (observation id: 124). Implementation verified against Engram spec: 6/6 PASS.

### Database — Engram Only

**File**: `openspec/specs/database/spec.md` — NOT CREATED
Spec existed only in Engram memory (observation id: 124). Implementation verified against Engram spec: 5/5 PASS, 1 SUGGESTION.

## Active Same-Domain Change Warning

`openspec/changes/add-remote-config-endpoint/specs/api/spec.md` also touches the API domain. No overlapping requirements — `hash-device-id` adds 6 new requirements that do not conflict with `add-remote-config-endpoint` delta.

## Verification Summary

| Spec Domain     | Result                 | Details                                                                             |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| Device Identity | 6/6 PASS               | All requirements met                                                                |
| API             | 5/7 PASS, 2 WARNING    | `hashDeviceId()` export missing; `?? 'unknown'` fallback missing on purchase create |
| Database        | 5/5 PASS, 1 SUGGESTION | `platformEnum` used instead of `text` (acceptable engineering tradeoff)             |

**Blockers**: None
**CRITICAL**: None

## Task Completion

All 17 tasks across 3 PRs are complete:

- **PR 1 (Backend)**: 9/9 ✅
- **PR 2 (Mobile + Shared)**: 6/6 ✅
- **PR 3 (Migration Script)**: 2/2 ✅

No unchecked implementation task boxes (`- [ ]`) remain in the persisted tasks artifact.

## Stale-Checkbox Reconciliation

Tasks 3.1 and 3.2 were listed with `✅` markers in the tasks artifact (not markdown checkboxes). The verify report (id: 130) and apply-progress (id: 128) confirm all migration script work is complete. No mechanical checkbox repair was needed.

## Destructive Merge Guard

Not applicable — no MODIFIED or REMOVED requirements in any spec domain.

## Risks

| Risk                                               | Severity | Mitigation                                                    |
| -------------------------------------------------- | -------- | ------------------------------------------------------------- |
| `hashDeviceId()` backward compat export missing    | LOW      | Nothing depends on it; `@sonora/shared` sha256() is canonical |
| Missing `?? 'unknown'` fallback on purchase create | LOW      | `platformGuard()` prevents the fallback from being reached    |
| `platformEnum` vs `text` spec mismatch             | LOW      | Enum provides better DB-level type safety                     |
| Experience access body fallback unreachable        | LOW      | `platformGuard()` prevents body scenario; spec needs update   |

## Structured Status

```json
{
  "change": "hash-device-id",
  "status": "archived",
  "pass": true,
  "warnings": 3,
  "suggestions": 2,
  "blocked": false,
  "actionContext": { "mode": "workspace-complete", "activeChange": "hash-device-id" },
  "reviewWorkload": {
    "chainedPRs": true,
    "chainStrategy": "stacked-to-main",
    "estimatedLinesChanged": "550-700"
  }
}
```

## Deliverables

- All 3 PRs merged to `hash-device-id` tracker branch
- PR #359 open: tracker → main (pending final review)
- Deployment order preserved: DDL migration → data migration → backend deploy → mobile deploy
