# Delta for API

## ADDED Requirements

### Requirement: Webhook signature validation

The `processWebhook` method MUST validate the `X-Signature` header using HMAC-SHA256 before fetching payment details. Invalid signatures MUST throw a generic external error (`InvalidSignature`) and log detailed internal diagnostics at `warn` level.

The `X-Signature` format MUST be parsed as `ts=<timestamp>,v1=<hmac_hex>` where `ts` is a Unix timestamp in seconds. The message template for HMAC-SHA256 MUST be `id:{data.id_url};request-id:{x-request-id};ts:{ts};` where `data.id_url` = `data.id` in lowercase.

| Element       | Constraint                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------- |
| Algorithm     | HMAC-SHA256 (via MP SDK's `WebhookSignatureValidator`, which uses `crypto.subtle` internally) |
| Key           | UTF-8 encoded `webhookSecret`                                                                 |
| Header source | `X-Signature` request header                                                                  |

#### Scenario: Valid signature processes webhook

- GIVEN a valid `X-Signature` header with matching HMAC-SHA256
- WHEN `processWebhook` receives the webhook payload
- THEN the method proceeds to fetch payment details and returns a `WebhookResult`

#### Scenario: Invalid HMAC rejects with generic error

- GIVEN an `X-Signature` header with mismatched HMAC
- WHEN `processWebhook` validates the signature
- THEN it throws `InvalidSignature` with a generic message (no HMAC details leaked externally)

#### Scenario: Missing or malformed X-Signature header

- GIVEN the request has no `X-Signature` header, or the header format is unparseable
- WHEN `processWebhook` attempts validation
- THEN it throws `InvalidSignature` and logs the raw header for debugging

### Requirement: Fail-fast configuration

The `MercadoPagoProvider` constructor MUST throw `TypeError` if `webhookSecret` is `undefined`, `null`, or an empty string. The factory export MUST NOT fall back to `""` — it MUST propagate the construction failure to startup.

#### Scenario: Missing secret throws at construction

- GIVEN no `MERCADO_PAGO_WEBHOOK_SECRET` env var is set
- WHEN `MercadoPagoProvider` is constructed with `webhookSecret` as `undefined` or `""`
- THEN the constructor throws `TypeError` with a message indicating the secret is required

#### Scenario: Factory with missing env var fails fast

- GIVEN `MERCADO_PAGO_WEBHOOK_SECRET` is unset in the environment
- WHEN the factory function creates `MercadoPagoProvider`
- THEN the factory does not construct the provider — it throws at initialization time

### Requirement: Replay protection

The `processWebhook` method MUST reject signatures whose `ts` (millisecond timestamp) falls outside a configurable max age window. The default window MUST be 5 minutes. The window period SHALL be configurable via a `signatureMaxAgeMinutes` parameter.

#### Scenario: Signature within time window is accepted

- GIVEN a valid `X-Signature` with `ts` less than 5 minutes old
- WHEN `processWebhook` validates the signature
- THEN the signature is accepted and processing continues normally

#### Scenario: Expired signature is rejected

- GIVEN a valid `X-Signature` with `ts` more than 5 minutes in the past
- WHEN `processWebhook` validates the signature
- THEN it throws `InvalidSignature` and logs the age discrepancy

#### Scenario: Future timestamp is rejected

- GIVEN a valid `X-Signature` with `ts` more than 5 minutes in the future (clock skew)
- WHEN `processWebhook` validates the signature
- THEN it throws `InvalidSignature`

### Requirement: Metrics and logging on invalid signature

Every invalid signature attempt MUST be logged internally at `warn` level with: `ts` value, `x-request-id`, `data.id`, and failure reason. A metric counter (`invalid_signature_total`) MUST be incremented on every rejection.

#### Scenario: Invalid signature increments counter

- GIVEN a webhook request with an invalid `X-Signature`
- WHEN the validation fails
- THEN the `invalid_signature_total` counter is incremented by exactly 1

#### Scenario: Log contains diagnostic details

- GIVEN a webhook request with an invalid `X-Signature`
- WHEN the validation fails
- THEN the log entry includes `ts`, `x-request-id`, `data.id`, and the specific failure reason
