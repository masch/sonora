# Apply Progress: Mercado Pago Webhook X-Signature Validation

## Status

17/17 tasks complete. All tests passing.

## TDD Cycle Evidence

| Cycle                     | RED (test written)                                                                       | GREEN (impl)                                                         | TRIANGULATE (edge cases)                                | SAFETY NET (existing pass) | REFACTOR                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------- | ----------------------------------------------------------- |
| 1 — signature.ts          | `signature.test.ts` — valid/invalid HMAC, missing/malformed header, missing x-request-id | `validateMercadoPagoSignature()`                                     | malformed header, missing header, empty x-request-id    | `bunx vitest run` ✅       | Extracted to pure function, no mocking needed               |
| 2 — replay protection     | `signature.test.ts` — within window, expired, future                                     | Replay window check in `validateMercadoPagoSignature()`              | Clock skew (future), boundary (exactly 5min)            | `bunx vitest run` ✅       | Inline Math.abs for both directions                         |
| 3 — constructor guard     | `mercadopago.test.ts` — empty/undefined secret                                           | Constructor TypeError in `MercadoPagoProvider`                       | Empty string, undefined, null                           | `bunx vitest run` ✅       | Types: `webhookSecret` required (`as string`, no `\|\| ''`) |
| 4 — processWebhook wiring | `mercadopago.test.ts` — valid signature, invalid HMAC, missing headers                   | `validateMercadoPagoSignature()` call before SDK fetch               | Missing x-signature, tampered HMAC, missing request-id  | `bunx vitest run` ✅       | Moved rawBody param removal, simplified interface           |
| 5 — staging bypass        | Manual verification (MP bug)                                                             | `skipSignatureValidation` config + staging check                     | Production guard (throws CRITICAL)                      | `bunx vitest run` ✅       | Renamed to `mpBypassSignature`                              |
| 6 — build-time migration  | N/A (config change)                                                                      | `MP_BYPASS_SIGNATURE`, `MP_SIGNATURE_MAX_AGE_MINUTES` via `[define]` | Both envs always have a value; production default false | `tsc --noEmit` ✅          | Removed from `Env` interface, no runtime fallback           |

## Completed Tasks

- [x] 1.1 RED: Write unit tests for `validateMercadoPagoSignature`
- [x] 1.2 GREEN: Create `apps/api/src/payments/signature.ts`
- [x] 1.3 RED: Write unit tests for replay protection
- [x] 1.4 GREEN: Add replay window check to `validateMercadoPagoSignature()`
- [x] 2.1 RED: Write test for constructor guard
- [x] 2.2 GREEN: Add constructor guard + `signatureMaxAgeMinutes` config
- [x] 2.3 RED: Update processWebhook test with valid/invalid signatures
- [x] 2.4 GREEN: Wire `validateMercadoPagoSignature()` into `processWebhook()`
- [x] 2.5 GREEN: Remove `|| ''` fallback in `index.ts`
- [x] 3.1 INVESTIGATE: MP preference webhook signing key bug
- [x] 3.2 GREEN: Add staging bypass for MP preference webhook bug
- [x] 3.3 SAFEGUARD: Production guard — throw CRITICAL if bypass enabled in production
- [x] 3.4 MIGRATE: Move bypass flag to build-time `[define] MP_BYPASS_SIGNATURE`
- [x] 3.5 MIGRATE: Move max age to build-time `[define] MP_SIGNATURE_MAX_AGE_MINUTES`
- [x] 3.6 RENAME: `skipSignatureValidation` → `mpBypassSignature`, `SKIP_SIGNATURE_VALIDATION` → `MP_BYPASS_SIGNATURE`
- [x] 3.7 HARDEN: All config fields required
- [x] 3.8 CLEANUP: Remove `MERCADO_PAGO_SIGNATURE_MAX_AGE_MINUTES` from Env

## Files Changed

| File                                         | Action   | What Was Done                                                                                                                                                                         |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/payments/signature.ts`         | Created  | `ValidationResult` + `validateMercadoPagoSignature()` with HMAC-SHA256, constant-time comparison, replay protection                                                                   |
| `apps/api/src/payments/mercadopago.ts`       | Modified | Constructor guard (throws on empty/undefined secret), added `signatureMaxAgeMinutes`, wired validator into `processWebhook()` with `logger.warn` + `[METRIC:invalid_signature_total]` |
| `apps/api/src/payments/index.ts`             | Modified | Removed `                                                                                                                                                                             |     | ''`fallback for`webhookSecret`— uses`as string` to pass through raw env value |
| `apps/api/src/__tests__/signature.test.ts`   | Created  | 8 unit tests: valid HMAC, invalid HMAC, missing header, malformed header, missing x-request-id, within window, expired, future                                                        |
| `apps/api/src/__tests__/mercadopago.test.ts` | Modified | Added 3 constructor tests, updated processWebhook test with valid signature, added 2 invalid signature tests                                                                          |
