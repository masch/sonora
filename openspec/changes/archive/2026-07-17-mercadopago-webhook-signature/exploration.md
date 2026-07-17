# Exploration: Mercado Pago Webhook X-Signature Validation

## Current State

### Architecture Overview

The webhook flow works as follows:

```
POST /payments/webhook
  → Hono route (routes/payments.ts:108)
  → Creates payment provider via createPaymentProviders(c.env)
  → Reads JSON payload + raw headers
  → Calls provider.processWebhook(payload, headers)
  → Updates purchase in DB with result
```

**Provider interface** (`provider.ts:33`):

```ts
processWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookResult>;
```

The `headers` parameter is already part of the contract, but...

**MercadoPagoProvider** (`mercadopago.ts:54`):

```ts
async processWebhook(payload: unknown, _headers: Record<string, string>): Promise<WebhookResult> {
```

The `_headers` parameter is **prefixed with underscore** (convention for unused) — it's received and immediately ignored. The method:

1. Casts payload to `{ type?, data?: { id? } }`
2. Rejects non-payment notifications
3. Fetches payment details from Mercado Pago API via `this.paymentClient.get()`
4. Returns mapped `WebhookResult`

**Constructor** (`mercadopago.ts:11-23`):

```ts
constructor(private config: { accessToken: string; webhookSecret: string }) {
```

The `webhookSecret` is stored but **never referenced** anywhere in the class.

**Factory** (`index.ts:5-16`):

```ts
webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET || '',
```

The `|| ''` fallback means an empty string is accepted — no fail-fast.

**Env type** (`index.ts:35`):

```ts
MERCADO_PAGO_WEBHOOK_SECRET?: string;
```

Optional field, no validation.

### Security Gap

The gap is at exactly **one point**: `mercadopago.ts` line 54 — `processWebhook` must validate the `X-Signature` header before processing the payload, but does nothing with it.

Without signature validation, an attacker can POST arbitrary payloads to `/payments/webhook` and:

- Mark purchases as `approved` that were never paid
- Trigger refund logic for legitimate purchases
- Cause inconsistent state between the payment provider and the local DB

## Affected Areas

| File                                          | Impact                                                                              | Change Required                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/api/src/payments/mercadopago.ts`        | Direct — provider holds `webhookSecret` but doesn't validate                        | Add HMAC-SHA256 signature validation in `processWebhook()` + constructor guard |
| `apps/api/src/payments/index.ts`              | Factory — `                                                                         |                                                                                | ''` allows empty secret | Remove ` |     | ''` to fail-fast when env var is missing |
| `apps/api/src/payments/provider.ts`           | Interface — already correct (`headers` is present)                                  | No change needed                                                               |
| `apps/api/src/routes/payments.ts`             | Route — already passes all headers                                                  | No change needed                                                               |
| `apps/api/src/__tests__/mercadopago.test.ts`  | Tests — existing `processWebhook` test passes signature but doesn't test validation | Add validation tests, update existing tests to provide valid signatures        |
| `apps/api/src/env.ts` (or wherever env typed) | Env type — `MERCADO_PAGO_WEBHOOK_SECRET` is optional                                | Consider making it required or adding runtime validation                       |

## Approaches

### Approach A: Validate inside `processWebhook` (inline)

Add signature validation directly in `MercadoPagoProvider.processWebhook()`.

**Strategy:**

- Parse `X-Signature` header for `ts` and `v1` values
- Extract `x-request-id` from headers
- Build the signed message: `id:{data.id};request-id:{x-request-id};ts:{ts};`
- Compute HMAC-SHA256 hex digest using `this.config.webhookSecret`
- Compare with `v1` from header (constant-time comparison)
- Throw on mismatch

**Pros:**

- Single file change (plus tests)
- All logic stays with the provider that owns the secret
- No new files, no new exports

**Cons:**

- Harder to unit-test the validation in isolation
- Mixes signature parsing, HMAC computation, and business logic in one method
- Less reusable if other parts of the system need signature verification

**Effort:** Low (one method, one helper)

### Approach B: Separate validation utility

Create a pure function `validateMercadoPagoSignature(headers, payload, secret)` in a new file, e.g., `apps/api/src/payments/signature.ts`.

**Strategy:**

- New file exports a standalone validation function
- Composable: receives all inputs explicitly
- `processWebhook()` calls it before processing
- Separates concerns: parsing, crypto, business logic

**Pros:**

- Highly testable in isolation (pure function, no class dependencies)
- Clear separation of concerns
- Reusable if other webhook types need validation
- The crypto details (message format, algorithm) are documented in one place

**Cons:**

- One more file in the project
- Slightly more complex test setup (need to mock or import crypto)

**Effort:** Low (new file + call site change + tests)

## Recommendation

**Approach B (separate validation utility)** — for these reasons:

1. **Testability**: The HMAC computation and signature parsing are a pure transformation (`headers + payload + secret → valid/invalid`). A standalone function is trivially testable without instantiating the full provider class.

2. **Separation of concerns**: `processWebhook` currently does payload parsing, API calls, and data mapping. Mixing cryptographic validation in the same method creates a method with too many responsibilities.

3. **Explicit documentation**: The Mercado Pago signature format is non-obvious (the `id:` field uses URL-safe lowercase, the message template is very specific). A dedicated utility with clear JSDoc documents this for future maintainers.

4. **No class dependency needed**: The validation only needs `headers`, the payload's `data.id`, and the `webhookSecret`. It doesn't need the Merado Pago SDK client at all.

The constructor guard (fail-fast if `webhookSecret` is missing) stays inside `MercadoPagoProvider` — that's a different concern.

### Additional Decision (confirmed by user):

- **Fail-fast on missing webhookSecret**: The provider constructor MUST throw if `webhookSecret` is empty or undefined. The factory (`index.ts`) MUST NOT use `|| ''`.
- **Always active**: X-Signature validation runs in ALL environments with no toggle.
- **Staging = Production**: Same validation, same behavior, same fail-fast.

## Risks

| Risk                                                                       | Likelihood | Impact                                                 | Mitigation                                                                                            |
| -------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Invalid signature format** — header missing `ts` or `v1`                 | Medium     | Denies legitimate webhooks                             | Parse gracefully, throw descriptive error                                                             |
| **Clock skew** — `ts` in signature is too far from server time             | Low-medium | Denies legitimate webhooks if we add replay protection | Log warning vs throw? Discuss in design phase                                                         |
| **Replay attacks** — same signature replayed                               | Low        | Could reprocess same purchase                          | Use idempotency on `providerPaymentId` (already exists?) + optionally add timestamp window validation |
| **x-request-id missing** — header not present in the webhook               | Low        | Cannot compute expected HMAC                           | Must be present per MP docs; throw if missing                                                         |
| **Payload structure changes** — MP changes the message template            | Low        | Validation fails silently                              | Log validation details for debugging                                                                  |
| **Crypto dependency** — `crypto.subtle` availability on Cloudflare Workers | Low        | Cannot compute HMAC                                    | Workers have Web Crypto API (`crypto.subtle`); use `Hmac` with `SHA-256`; verify in test              |

## Ready for Proposal

**Yes.** The security gap is well-understood, the scope is small, and the user has already confirmed key design decisions (always active, fail-fast, staging = production). All four SDD phases (spec, design, tasks, apply) can proceed.

The orchestrator should:

1. Tell the user the exploration is complete
2. The recommended approach is **Approach B** (separate utility)
3. The key decisions (always active, fail-fast, staging=prod) are already confirmed
4. Move to `sdd-propose` to formalize scope, approach, and rollback plan
