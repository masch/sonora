# Archive Report: Mercado Pago Webhook X-Signature Validation

**Change**: mercadopago-webhook-signature
**Archived at**: `openspec/changes/archive/2026-07-17-mercadopago-webhook-signature/`
**Archive date**: 2026-07-17
**Artifact store**: hybrid (OpenSpec filesystem + Engram)

## Status

- **Tasks**: 17/17 complete ✅
- **Apply progress**: 17/17 complete ✅
- **Review gate**: No native review artifacts present (archived based on orchestrator confirmation with completed tasks and apply-progress evidence)
- **Intent**: Full archive with no warnings

## Delta Spec Sync

| Action | Domain | Details                                                             |
| ------ | ------ | ------------------------------------------------------------------- |
| ADDED  | api    | Requirement: Webhook signature validation (3 scenarios)             |
| ADDED  | api    | Requirement: Fail-fast configuration (2 scenarios)                  |
| ADDED  | api    | Requirement: Replay protection (3 scenarios)                        |
| ADDED  | api    | Requirement: Metrics and logging on invalid signature (2 scenarios) |

No MODIFIED, REMOVED, or RENAMED requirements in the delta.

Existing requirements (Version environment variables, Version fields in config response) preserved unchanged.

## Source of Truth Updated

`openspec/specs/api/spec.md` — now includes 4 new MercadoPago webhook requirements.

## Implementation Summary

### What was built

- **`apps/api/src/payments/signature.ts`** (new) — `ValidationResult` + `validateMercadoPagoSignature()` with HMAC-SHA256, constant-time comparison via `crypto.subtle`, and replay protection
- **`apps/api/src/payments/mercadopago.ts`** (modified) — constructor guard (throws on empty/undefined secret), `signatureMaxAgeMinutes` config, wired validator into `processWebhook()`
- **`apps/api/src/payments/index.ts`** (modified) — removed `|| ''` fallback from `webhookSecret`
- **`apps/api/src/__tests__/signature.test.ts`** (new) — 8 unit tests
- **`apps/api/src/__tests__/mercadopago.test.ts`** (modified) — constructor + webhook validation tests

### Key decisions

- Separate validation utility (not inline in provider) — pure function, zero mocking for tests
- HMAC-SHA256 via Web Crypto API (`crypto.subtle`) — only available crypto on Cloudflare Workers
- Replay window as constructor config parameter, not `processWebhook` param — avoids polluting `PaymentProvider` interface
- Build-time defines: `MP_BYPASS_SIGNATURE` (bool), `MP_SIGNATURE_MAX_AGE_MINUTES` (number)
- Production safety guard: throws `CRITICAL` if `mpBypassSignature` is true in production
- All `MercadoPagoProvider` config fields now required (no `?:`) — no hidden defaults

### Verification

- **28/28 tests passing** (bunx vitest run) ✅
- **TypeScript clean compile** (`tsc --noEmit`) ✅
- Note: No separate `verify-report.md` was persisted in the change folder; verification status is sourced from `apply-progress.md` and orchestrator confirmation.

## Archived Artifacts

| Artifact          | Status | Path                                                                                  |
| ----------------- | ------ | ------------------------------------------------------------------------------------- |
| exploration.md    | ✅     | `openspec/changes/archive/2026-07-17-mercadopago-webhook-signature/exploration.md`    |
| proposal.md       | ✅     | `openspec/changes/archive/2026-07-17-mercadopago-webhook-signature/proposal.md`       |
| specs/api/spec.md | ✅     | `openspec/changes/archive/2026-07-17-mercadopago-webhook-signature/specs/api/spec.md` |
| design.md         | ✅     | `openspec/changes/archive/2026-07-17-mercadopago-webhook-signature/design.md`         |
| tasks.md          | ✅     | `openspec/changes/archive/2026-07-17-mercadopago-webhook-signature/tasks.md`          |
| apply-progress.md | ✅     | `openspec/changes/archive/2026-07-17-mercadopago-webhook-signature/apply-progress.md` |
| archive-report.md | ✅     | `openspec/changes/archive/2026-07-17-mercadopago-webhook-signature/archive-report.md` |

## Engram Persistence

Attempted Engram save for `sdd/mercadopago-webhook-signature/archive-report` — `mem_save` MCP tool was not available in this session's tool set. Engram observation for this archive report was not persisted. Engram read tools were also unavailable, so pre-existing Engram artifact observation IDs could not be retrieved for the report.
