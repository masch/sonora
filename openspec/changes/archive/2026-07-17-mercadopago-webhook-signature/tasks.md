# Tasks: Mercado Pago Webhook X-Signature Validation

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | ~130-150    |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | Single PR   |
| Delivery strategy       | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation — signature.ts

- [x] 1.1 RED: Write unit tests for `validateMercadoPagoSignature` — valid HMAC, invalid HMAC, missing X-Signature header, malformed header, missing `x-request-id`
- [x] 1.2 GREEN: Create `apps/api/src/payments/signature.ts` — `ValidationResult` type + `validateMercadoPagoSignature()` with HMAC-SHA256 via `crypto.subtle` and constant-time comparison
- [x] 1.3 RED: Write unit tests for replay protection — within 5min window, expired (>5min past), future (>5min clock skew)
- [x] 1.4 GREEN: Add `maxAgeMinutes` parameter (default 5) and timestamp window check to `validateMercadoPagoSignature()`

## Phase 2: Provider Wiring

- [x] 2.1 RED: Write test for constructor guard — `MercadoPagoProvider` throws `TypeError` when `webhookSecret` is empty/undefined
- [x] 2.2 GREEN: Add constructor guard to `MercadoPagoProvider` in `mercadopago.ts` + add `signatureMaxAgeMinutes` to config (default 5)
- [x] 2.3 RED: Update existing `processWebhook` test with pre-computed valid `X-Signature`; write test for invalid signature — throws `InvalidSignature`, increments `invalid_signature_total`
- [x] 2.4 GREEN: Update `processWebhook()` to call `validateMercadoPagoSignature()` before SDK fetch, throw `InvalidSignature` with `logger.warn` + counter
- [x] 2.5 GREEN: Update `apps/api/src/payments/index.ts` — remove `|| ''` fallback so missing `MERCADO_PAGO_WEBHOOK_SECRET` fails at construction

## Phase 3: Staging bypass for MP preference webhook bug

- [x] 3.1 INVESTIGATE: Confirm MP's preference-level `notification_url` uses a different signing key than the dashboard global webhook URL — signature matches in simulator but fails for real payment notifications
- [x] 3.2 GREEN: Add `skipSignatureValidation: boolean` to config, bypass validation when set (initially wired to `ENVIRONMENT === 'staging'`)
- [x] 3.3 SAFEGUARD: Add non-production guard — throw `CRITICAL` if bypass is true but `environment === 'production'`
- [x] 3.4 MIGRATE: Move `skipSignatureValidation` from runtime env var to build-time `[define] MP_BYPASS_SIGNATURE` in both `wrangler.toml` and `wrangler.staging.toml`
- [x] 3.5 MIGRATE: Move `signatureMaxAgeMinutes` from runtime env var to build-time `[define] MP_SIGNATURE_MAX_AGE_MINUTES`
- [x] 3.6 RENAME: Generic `skipSignatureValidation` → MP-specific `mpBypassSignature` in config, `SKIP_SIGNATURE_VALIDATION` → `MP_BYPASS_SIGNATURE` in defines, update all references and tests
- [x] 3.7 HARDEN: Make all `MercadoPagoProvider` config fields required (remove `?:` from `mpBypassSignature` and `signatureMaxAgeMinutes`) — no hidden defaults
- [x] 3.8 CLEANUP: Remove `MERCADO_PAGO_SIGNATURE_MAX_AGE_MINUTES` from `Env` interface (no longer read at runtime)

### Suggested Work Units

| Unit | Goal                        | Likely PR | Focused test command                                               | Runtime harness | Rollback boundary                                                         |
| ---- | --------------------------- | --------- | ------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------- |
| 1    | Full X-Signature validation | PR 1      | `cd apps/api && bunx vitest run src/__tests__/mercadopago.test.ts` | `make api-test` | Revert `signature.ts` creation + edits to `mercadopago.ts` and `index.ts` |
