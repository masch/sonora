# Proposal: Mercado Pago Webhook X-Signature Validation

## Intent

Security fix — validate `X-Signature` HMAC-SHA256 on incoming Mercado Pago webhook notifications. Currently `webhookSecret` is stored but never checked, so arbitrary POSTs to `/payments/webhook` can mark purchases as approved without real payment.

## Scope

### In Scope

- New `apps/api/src/payments/signature.ts` — standalone `validateMercadoPagoSignature()` function
- Constructor guard in `MercadoPagoProvider` — throws if `webhookSecret` missing/empty
- Factory fix (`index.ts`) — remove `|| ''` fallback so missing secret causes fail-fast at startup
- `processWebhook()` updated to call validator before fetching payment details
- Replay protection — `processWebhook` accepts `signatureMaxAgeMinutes` option (default 5), rejects if `ts` exceeds window
- Internal logging + metrics tracking on invalid signature detection (log warning, increment counter)
- Tests for validation utility, replay protection, constructor guard
- Update existing `processWebhook` test to provide valid signatures

### Out of Scope

- Idempotency layer (DB-level dedup by `providerPaymentId` already exists)
- Other payment providers (Stripe, PayPal — both null)
- Making `MERCADO_PAGO_WEBHOOK_SECRET` required in env types (optional is fine, runtime guard covers it)

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api`: New webhook signature validation requirements added. Payment webhook processing now requires valid `X-Signature` with HMAC verification and replay window enforcement.

## Approach

Separate validation utility (`signature.ts`) — pure function receiving headers, payload body, and secret. Returns structured result. `processWebhook()` calls it first, throws on invalid signature before any API call. Constructor throws on missing/empty secret. Factory removes `|| ''`. Replay window checked using `ts` field from `X-Signature`. Invalid signatures log full internal details (for attack detection) and throw a generic error externally. Metrics tracked via `logger.warn` + counter increment.

## Affected Areas

| Area                                         | Impact   | Description                                             |
| -------------------------------------------- | -------- | ------------------------------------------------------- |
| `apps/api/src/payments/signature.ts`         | New      | Standalone `validateMercadoPagoSignature()`             |
| `apps/api/src/payments/mercadopago.ts`       | Modified | Constructor guard + validation call in `processWebhook` |
| `apps/api/src/payments/index.ts`             | Modified | Remove `                                                |     | ''` fallback |
| `apps/api/src/__tests__/mercadopago.test.ts` | Modified | Update existing test, add validation + guard tests      |

## Risks

| Risk                                                    | Likelihood | Mitigation                               |
| ------------------------------------------------------- | ---------- | ---------------------------------------- |
| Invalid `X-Signature` format denies legitimate webhooks | Low        | Parse gracefully, validate clearly       |
| Clock skew rejects valid webhooks                       | Low        | Configurable time window (default 5 min) |
| Missing `x-request-id` header                           | Low        | Reject with clear error                  |

## Rollback Plan

1. Revert the change commit
2. If running without signature validation, unset `MERCADO_PAGO_WEBHOOK_SECRET` env var (reverting code is safer)

## Dependencies

- Web Crypto API (`crypto.subtle`) — native on Cloudflare Workers, no install needed

## Success Criteria

- [ ] Legitimate MP webhooks still process and return correct `WebhookResult`
- [ ] Invalid signatures are rejected with a generic error + logged internally
- [ ] Missing/empty `webhookSecret` at construction throws immediately
- [ ] Replay window rejects signatures with `ts` beyond configured threshold
- [ ] All new + existing tests pass
