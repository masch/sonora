# Design: Mercado Pago Webhook X-Signature Validation

## Technical Approach

Separate a pure validation utility (`signature.ts`) from the provider, call it at the top of `processWebhook()` before any payment-API interaction, and fail fast at construction if the secret is empty. The factory (`index.ts`) drops the `|| ''` fallback so a missing env var surfaces at Worker boot, not on the first webhook.

## Architecture Decisions

### Utility vs inline in MercadoPagoProvider

| Option                                   | Tradeoff                                                                                          | Decision |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| Inline in `processWebhook`               | Less indirection, but untestable without constructing a full provider + mocking the SDK           | ❌       |
| Separate pure function in `signature.ts` | Testable with 0 mocking, reusable if another route needs manual validation, single responsibility | ✅       |

### HMAC-SHA256 via Web Crypto API

`crypto.subtle` is the only available crypto primitive on Cloudflare Workers — no Node.js `crypto` module. The MP SDK's `WebhookSignatureValidator` wraps `crypto.subtle` internally: the HMAC key is imported as `raw` (UTF-8 encoded secret), algorithm `HMAC-SHA256`. The computed digest is hex-encoded and compared constant-time against the `v1` value from the header using `crypto.subtle.timingSafeEqual`.

### Replay window — constructor parameter vs processWebhook param

| Option                                               | Tradeoff                                                              | Decision |
| ---------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| `signatureMaxAgeMinutes` on `processWebhook`         | Pollutes the `PaymentProvider` interface for a MP-specific concern    | ❌       |
| Config property on `MercadoPagoProvider` constructor | Stored once, used by `processWebhook` internally; no interface change | ✅       |

Default: 5 minutes. Accepts positive integers only; 0 or negative disables replay check.

### Error strategy

| Layer               | What                                                | Why                                                    |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| External (response) | Generic `InvalidSignature` error                    | No HMAC internals or header details leaked to attacker |
| Internal (logger)   | `warn` with `ts`, `x-request-id`, `data.id`, reason | Attack detection and debugging                         |
| Metrics             | Counter `invalid_signature_total` incremented       | Monitoring alert baseline                              |

## Data Flow

```
Mercado Pago                Hono Route                    MercadoPagoProvider              signature.ts
    │                           │                               │                              │
    ├── POST /payments/webhook ──→ receive payload + headers ──→ processWebhook() ──────────────→ validateMercadoPagoSignature()
    │                           │                               │                                   │
    │                           │                               │                              ├── parse X-Signature (ts, v1)
    │                           │                               │                              ├── check replay window
    │                           │                               │                              ├── HMAC-SHA256(secret, msg)
    │                           │                               │                              └── return { valid, reason? }
    │                           │                               │                              │
    │                           │                               │                         ←──── result
    │                           │                               │                              │
    │                           │                               │                         ┌── valid? → fetch payment via SDK
    │                           │                               │                         └── invalid? → throw InvalidSignature
    │                           │                               │                                        log warn, increment counter
    │                           │                         ←──── WebhookResult
    │                           │                         ←──── error (caught by Hono onError)
    │                           │                              │
    │                           │                         update Purchase in DB
    │                           │                         return { status: "ok" }
```

## File Changes

| File                                         | Action     | Description                                                                                                          |
| -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/payments/signature.ts`         | **Create** | Pure `validateMercadoPagoSignature()` function + `ValidationResult` type                                             |
| `apps/api/src/payments/mercadopago.ts`       | Modify     | Add constructor guard; call validator in `processWebhook` before SDK call; accept `signatureMaxAgeMinutes` in config |
| `apps/api/src/payments/index.ts`             | Modify     | Remove `                                                                                                             |     | ''`fallback for`webhookSecret` — let constructor throw |
| `apps/api/src/__tests__/mercadopago.test.ts` | Modify     | Add signature utility tests, constructor guard test, update existing webhook test with valid signature               |

## Interfaces / Contracts

```typescript
// apps/api/src/payments/signature.ts

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateMercadoPagoSignature(
  headers: Record<string, string>,
  body: unknown,
  secret: string,
  maxAgeMinutes?: number, // default 5; 0 or negative disables replay check
): Promise<ValidationResult>;
```

```typescript
// apps/api/src/payments/mercadopago.ts — modified config type
interface MercadoPagoConfig {
  accessToken: string;
  webhookSecret: string;
  signatureMaxAgeMinutes?: number; // NEW, default 5
}
```

## Testing Strategy

| Layer                 | What                                                                               | Approach                                                  |
| --------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Unit — signature      | Valid HMAC, invalid HMAC, malformed header, missing header, missing `x-request-id` | Pure function calls, no mocking, known input/output pairs |
| Unit — replay         | Signature within window, expired (>5min), future (>5min clock skew)                | Control `Date.now()` via `vi.setSystemTime`               |
| Unit — constructor    | Empty secret, undefined secret, valid secret                                       | Assert `TypeError` thrown or not                          |
| Integration — webhook | Existing test updated to pass valid `X-Signature` header                           | Pre-compute HMAC for known test secret + payload          |
| Integration — webhook | Invalid signature triggers `InvalidSignature` error                                | Assert error thrown, assert counter increment             |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Valid requests continue to work as before. Any attacker relying on missing validation will see rejection after deployment. If the env var `MERCADO_PAGO_WEBHOOK_SECRET` is not set, the Worker will fail to boot — verify it's set in all environments before deploying.

## Open Questions

None.
