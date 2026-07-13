# MercadoPago Payment Integration — Specification

**Change**: `mercadopago-payment`
**Project**: Sonora
**Date**: 2026-07-11
**Status**: Draft Specification

---

## Purpose

Add payment capability to Sonora's experiences (tracks and trips) through a provider-agnostic payment abstraction. MercadoPago is the first provider implementation, with Stripe and PayPal as future additions. Experiences can be free (`free: true`) or paid (`free: false` with a `price`). Users purchase individual experiences and can restore their purchases via email from the experience detail screen.

---

## Capabilities

### New Capability: Experience Payment

The system SHALL support marking experiences as free or paid, processing payments through registered providers, and verifying purchase status before unlocking paid content.

---

## Functional Requirements

### Requirement: Experience Pricing

Every experience MUST have a `free` flag and an optional `price` when the experience is paid.

#### Scenario: Free experience is playable without payment

- GIVEN an experience with `free: true`
- WHEN a user opens the experience detail
- THEN the play button SHALL be immediately available
- AND no payment prompt SHALL be shown
- AND no email SHALL be required

#### Scenario: Paid experience shows price before play

- GIVEN an experience with `free: false` and `price: 1500`
- WHEN a user opens the experience detail
- AND the experience has NOT been purchased by the user
- THEN the play button SHALL NOT be shown
- AND a payment prompt SHALL be displayed with the price `ARS 1500`
- AND two actions SHALL be available: "Pay" and "Restore Purchases"

#### Scenario: Paid experience is playable after purchase

- GIVEN an experience with `free: false` and `price: 1500`
- WHEN a user has purchased this experience
- THEN the play button SHALL be immediately available
- AND no payment prompt SHALL be shown

### Requirement: Payment Provider Abstraction

The system MUST support multiple payment providers through a common interface, with MercadoPago as the first implementation.

#### Scenario: Backend routes are provider-agnostic

- GIVEN the payment API
- WHEN a client calls `POST /payments/create` with `{ experienceId }`
- THEN the backend SHALL use the configured default provider to create a checkout
- AND the response SHALL contain `{ checkoutUrl, purchaseId }` — no provider-specific details

#### Scenario: A new provider can be added without mobile changes

- GIVEN the `PaymentProvider` interface
- WHEN a new provider is implemented (e.g. Stripe)
- THEN only backend code SHALL change
- AND no mobile code SHALL be modified
- AND the DB enum `payment_provider` SHALL be extended via `ALTER TYPE`

### Requirement: MercadoPago Checkout Pro

The MercadoPago provider SHALL use Checkout Pro (redirect) for payment processing.

#### Scenario: Backend creates MP preference

- GIVEN a paid experience
- WHEN `POST /payments/create` is called
- THEN the backend SHALL call the MercadoPago API to create a checkout preference
- AND the preference SHALL include:
  - `items`: the experience title and price
  - `back_urls`: success, failure, pending deep links
  - `notification_url`: the backend webhook URL
  - `external_reference`: the purchase ID
- AND the response SHALL contain the `checkoutUrl` from MP

#### Scenario: Webhook marks payment as approved

- GIVEN a MercadoPago payment notification
- WHEN `POST /payments/webhook` is called with valid MP payload
- THEN the backend SHALL validate the webhook signature
- AND SHALL update the purchase status to `approved`
- AND SHALL extract and store the payer email from the MP payload

### Requirement: Purchase Verification

The system MUST allow checking whether an email has purchased a given experience.

#### Scenario: Check purchase status by purchase ID

- GIVEN a purchase was created
- WHEN `GET /payments/status/:purchaseId` is called
- THEN the response SHALL contain `{ status, email, experienceId, provider }`

#### Scenario: Check if email has purchased an experience

- GIVEN an email and an experience ID
- WHEN `GET /experiences/:id/purchased?email=` is called
- THEN the response SHALL contain `{ purchased: true | false }`
- AND if `true`, SHALL include the purchase details

#### Scenario: List all purchases for email

- GIVEN an email
- WHEN `GET /purchases?email=` is called
- THEN the response SHALL contain all purchases for that email
- AND each purchase SHALL include experience details

### Requirement: Mobile Payment Flow

The mobile app SHALL guide users through payment and restore without requiring an account.

#### Scenario: User pays for an experience

- GIVEN a paid experience not yet purchased
- WHEN the user taps "Pay with MercadoPago"
- THEN the app SHALL call `POST /payments/create`
- AND SHALL open the `checkoutUrl` via `expo-web-browser`
- AND SHALL poll `GET /payments/status/:purchaseId` every 2 seconds for up to 30 seconds
- AND when status is `approved`, SHALL save the purchase locally and show the play button

#### Scenario: Payment polling timeout

- GIVEN a payment was initiated
- WHEN 30 seconds pass without the purchase being approved
- THEN the app SHALL show a "Payment pending" message
- AND SHALL provide a "Check payment status" button to retry the poll
- AND the webhook SHALL complete the purchase asynchronously

#### Scenario: User restores purchases via email bottom modal

- GIVEN a paid experience not yet purchased
- WHEN the user taps "Restore Purchases"
- THEN a bottom modal SHALL open (using the existing `BottomModal` component)
- AND the modal SHALL contain an email input and a "Restore" button
- WHEN the user enters their email and taps "Restore"
- THEN the app SHALL call `GET /experiences/:id/purchased?email=`
- AND if `purchased: true`, the experience SHALL be unlocked immediately
- AND if `purchased: false`, a message SHALL be shown: "No purchases found for this email"

### Requirement: Data Model

The data model SHALL support provider-agnostic payments with a DB-level constraint on provider names.

#### Scenario: Experiences table changes

- GIVEN the existing experiences schema
- THEN `priceLabel` (text) SHALL be replaced by:
  - `free` (boolean, default true, not null)
  - `price` (integer, nullable — price in ARS)
- AND the seed data SHALL be updated accordingly

#### Scenario: Purchases table

- GIVEN a new table `purchases`
- THEN it SHALL contain:
  - `id` (UUID, PK)
  - `email` (text, nullable until webhook resolves)
  - `experience_id` (UUID, FK → experiences, not null)
  - `provider` (payment_provider enum, not null)
  - `provider_payment_id` (text, not null, unique)
  - `status` (text, not null, default 'pending')
  - `amount` (integer, not null — in cents)
  - `currency` (text, not null, default 'ARS')
  - `metadata` (jsonb, nullable — provider-specific payload)
  - `created_at` (timestamptz, not null)
  - `updated_at` (timestamptz, not null)

#### Scenario: Payment provider enum

- GIVEN a new PostgreSQL enum `payment_provider`
- THEN it SHALL contain values: `'mercadopago'`, `'stripe'`, `'paypal'`
- AND the DB SHALL reject any values not in the enum

---

## Non-Functional Requirements

### Requirement: Security — Payment Credentials

MercadoPago access tokens MUST NOT be stored in the repository, workflow files, or CI logs.

#### Scenario: MP credentials are environment variables

- GIVEN the API environment
- THEN `MERCADO_PAGO_ACCESS_TOKEN` and `MERCADO_PAGO_WEBHOOK_SECRET` SHALL be configured as environment variables
- AND they SHALL NOT appear in any source files

### Requirement: Error Handling — Payment Failure

Payment failures MUST NOT crash the app and MUST provide clear feedback.

#### Scenario: Network error during payment creation

- GIVEN the user taps "Pay"
- WHEN `POST /payments/create` fails (network error)
- THEN the app SHALL show an error message "Could not connect to payment service"
- AND SHALL provide a "Retry" button

#### Scenario: Webhook signature mismatch

- GIVEN the backend receives a webhook request
- WHEN the signature does not match
- THEN the backend SHALL return HTTP 401
- AND SHALL NOT update any purchase status

### Requirement: Local Purchase Cache

The mobile app SHALL cache purchase status locally to avoid API calls on every app open.

#### Scenario: Purchased experiences cached locally

- GIVEN a successful purchase
- THEN the experience ID SHALL be saved to local storage (AsyncStorage)
- WHEN the user reopens the app
- AND the experience was previously purchased
- THEN the app SHALL show the play button immediately without an API call
- AND SHALL refresh the cache from the API periodically

---

## Change Specification

### Files Changed

#### packages/shared/src/experiences.ts

| Change                                     | Type     | Details                    |
| ------------------------------------------ | -------- | -------------------------- |
| Replace `priceLabel` with `free` + `price` | MODIFIED | `BaseExperience` interface |

```typescript
export interface BaseExperience {
  // ... existing fields ...
  free: boolean; // ADDED — true by default
  price?: number | null; // ADDED — price in ARS, null if free
  // priceLabel removed
}
```

#### packages/shared/src/index.ts

| Change           | Type     | Details                       |
| ---------------- | -------- | ----------------------------- |
| Export new types | MODIFIED | Export purchase-related types |

#### apps/api/src/db/schema.ts

| Change                                     | Type     | Details                               |
| ------------------------------------------ | -------- | ------------------------------------- |
| Add `payment_provider` enum                | ADDED    | `['mercadopago', 'stripe', 'paypal']` |
| Replace `priceLabel` with `free` + `price` | MODIFIED | experiences table                     |
| Add `purchases` table                      | ADDED    | New table with FK → experiences       |

#### apps/api/src/db/seed.ts

| Change                      | Type     | Details                                    |
| --------------------------- | -------- | ------------------------------------------ |
| Update experience seed data | MODIFIED | Replace `priceLabel` with `free` + `price` |

#### apps/api/src/index.ts

| Change                | Type     | Details                                      |
| --------------------- | -------- | -------------------------------------------- |
| Mount payments router | MODIFIED | Add `app.route('/payments', paymentsRouter)` |

#### apps/api/src/routes/payments.ts (NEW)

| Change                             | Type  | Details                             |
| ---------------------------------- | ----- | ----------------------------------- |
| `POST /payments/create`            | ADDED | Create checkout via provider        |
| `POST /payments/webhook`           | ADDED | Handle provider webhooks            |
| `GET /payments/status/:purchaseId` | ADDED | Check purchase status               |
| `GET /experiences/:id/purchased`   | ADDED | Check if email purchased experience |
| `GET /purchases`                   | ADDED | List purchases by email             |

#### apps/api/src/payments/provider.ts (NEW)

| Change                      | Type  | Details                               |
| --------------------------- | ----- | ------------------------------------- |
| `PaymentProvider` interface | ADDED | Abstract payment contract             |
| `MercadoPagoProvider` class | ADDED | MP Checkout Pro implementation        |
| Provider registry           | ADDED | `providers` map with default provider |

#### apps/api/.env.example

| Change             | Type     | Details                                                    |
| ------------------ | -------- | ---------------------------------------------------------- |
| Add MP credentials | MODIFIED | `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` |

#### apps/mobile/src/data/experiences.ts

| Change               | Type     | Details                          |
| -------------------- | -------- | -------------------------------- |
| Update imports/types | MODIFIED | Sync with shared package changes |

#### apps/mobile/src/components/trip-detail-view.tsx

| Change                 | Type     | Details                                             |
| ---------------------- | -------- | --------------------------------------------------- |
| Add payment/restore UI | MODIFIED | Payment prompt + restore modal for paid experiences |

#### apps/mobile/src/components/track-detail-view.tsx

| Change                 | Type     | Details                                             |
| ---------------------- | -------- | --------------------------------------------------- |
| Add payment/restore UI | MODIFIED | Payment prompt + restore modal for paid experiences |

#### apps/mobile/src/hooks/use-purchase.ts (NEW)

| Change                   | Type  | Details                                                         |
| ------------------------ | ----- | --------------------------------------------------------------- |
| Purchase management hook | ADDED | `usePurchase(experienceId)` — check status, pay, restore, cache |

#### apps/mobile/src/services/payment-client.ts (NEW)

| Change             | Type  | Details                 |
| ------------------ | ----- | ----------------------- |
| Payment API client | ADDED | Wraps payment API calls |

#### apps/mobile/src/storage/app-storage.ts

| Change                  | Type     | Details                                    |
| ----------------------- | -------- | ------------------------------------------ |
| Add purchase cache keys | MODIFIED | Local storage for purchased experience IDs |

#### apps/mobile/src/i18n/locales/es.ts

| Change              | Type     | Details                        |
| ------------------- | -------- | ------------------------------ |
| Add payment strings | MODIFIED | New i18n keys for payment flow |

#### apps/mobile/src/i18n/locales/en.ts

| Change              | Type     | Details                        |
| ------------------- | -------- | ------------------------------ |
| Add payment strings | MODIFIED | New i18n keys for payment flow |

---

## API Specification

### POST /payments/create

Create a checkout session for an experience.

**Request:**

```json
{
  "experienceId": "uuid"
}
```

**Response (200):**

```json
{
  "purchaseId": "uuid",
  "checkoutUrl": "https://www.mercadopago.com.ar/checkout/v1/..."
}
```

**Errors:**

- `404` — Experience not found
- `400` — Experience is free (no payment needed)
- `500` — Payment provider error

### POST /payments/webhook

Handle payment provider webhook notifications.

**Request:** Provider-specific payload (MercadoPago IPN JSON)

**Response (200):**

```json
{ "status": "ok" }
```

**Errors:**

- `401` — Invalid webhook signature
- `404` — Purchase not found

### GET /payments/status/:purchaseId

Check the status of a purchase.

**Response (200):**

```json
{
  "purchaseId": "uuid",
  "status": "approved" | "pending" | "rejected" | "refunded",
  "experienceId": "uuid",
  "provider": "mercadopago",
  "amount": 1500,
  "currency": "ARS"
}
```

**Errors:**

- `404` — Purchase not found

### GET /experiences/:id/purchased?email=

Check if an email has purchased a specific experience.

**Query:** `email=user@example.com`

**Response (200):**

```json
{
  "purchased": true,
  "purchase": {
    "purchaseId": "uuid",
    "status": "approved",
    "provider": "mercadopago",
    "amount": 1500,
    "currency": "ARS",
    "purchasedAt": "2026-07-11T10:00:00Z"
  }
}
```

### GET /purchases?email=

List all purchases for an email.

**Query:** `email=user@example.com`

**Response (200):**

```json
{
  "purchases": [
    {
      "purchaseId": "uuid",
      "experienceId": "uuid",
      "experienceTitle": "Deriva por el centro",
      "experienceSlug": "umepay-bosque",
      "status": "approved",
      "provider": "mercadopago",
      "amount": 1500,
      "currency": "ARS",
      "purchasedAt": "2026-07-11T10:00:00Z"
    }
  ]
}
```

---

## PaymentProvider Interface

```typescript
interface CheckoutParams {
  purchaseId: string;
  experienceTitle: string;
  amount: number;
  currency: string;
  description: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  notificationUrl: string;
}

interface CheckoutResult {
  checkoutUrl: string;
  providerPaymentId: string;
}

interface WebhookResult {
  event: 'payment.approved' | 'payment.rejected' | 'payment.refunded';
  providerPaymentId: string;
  email: string;
  amount: number;
}

interface PaymentProvider {
  readonly name: string;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  processWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookResult>;
  getPaymentStatus(providerPaymentId: string): Promise<{
    status: 'approved' | 'pending' | 'rejected';
    email?: string;
    amount?: number;
  }>;
}
```

---

## Mobile UI Specification

### Payment Screen (inside TripDetailView / TrackDetailView)

When a paid experience is loaded and NOT purchased:

```
┌──────────────────────────────────┐
│  [Image]                         │
│                                  │
│  Track Title                     │
│  Description text                │
│                                  │
│  ════════════════════════════    │
│                                  │
│     💳 Esta experiencia es       │
│        una experiencia paga      │
│                                  │
│     ARS 1.500                    │
│                                  │
│     ┌────────────────────┐       │
│     │  Pagar con MercadoPago │   │
│     └────────────────────┘       │
│                                  │
│     [¿Ya la compraste?           │
│      Restaurar compras]          │
│                                  │
│  ════════════════════════════    │
│                                  │
│  [Map / other content]           │
└──────────────────────────────────┘
```

### Restore Bottom Modal

When user taps "Restaurar compras":

```
┌──────────────────────────────────┐
│                                  │
│  🔄 Restaurar compras            │
│                                  │
│  Ingresá el email que usaste     │
│  para comprar esta experiencia   │
│                                  │
│  ┌──────────────────────────┐    │
│  │  email@ejemplo.com       │    │
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │  Restaurar               │    │
│  └──────────────────────────┘    │
│                                  │
│  [Cancelar]                      │
│                                  │
└──────────────────────────────────┘
```

State: loading, error ("No se encontraron compras para este email"), success (modal closes, experience unlocked).

---

## Verification Specification

### Phase 1 Verification

| Test                              | Method                                                      | Pass Criteria                                |
| --------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| Free experience plays immediately | Open free experience                                        | Play button visible, no payment prompt       |
| Paid experience shows price       | Open paid experience (not purchased)                        | Price displayed, pay/restore buttons visible |
| MP checkout is created            | Trigger POST /payments/create                               | Returns valid checkoutUrl                    |
| MP redirect works                 | Open checkoutUrl in browser                                 | MP checkout page loads                       |
| Webhook updates purchase          | Simulate MP webhook with valid payload                      | DB purchase status = 'approved'              |
| Email captured from webhook       | After webhook, check DB                                     | purchase.email is populated                  |
| Restore by email                  | Call GET /experiences/:id/purchased?email= with valid email | `purchased: true`                            |
| Restore with wrong email          | Same call with unknown email                                | `purchased: false`                           |
| List purchases by email           | Call GET /purchases?email=                                  | Returns all purchases for that email         |
| Provider enum validation          | INSERT with invalid provider                                | DB rejects row                               |

### Phase 2 Verification (Stripe, PayPal — future)

| Test                                   | Method                                           | Pass Criteria                      |
| -------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| New provider enum value                | `ALTER TYPE payment_provider ADD VALUE 'stripe'` | Enum updated, existing data intact |
| New provider creates checkout          | Call createCheckout on StripeProvider            | Returns valid checkoutUrl          |
| Existing routes work with new provider | Same API calls as Phase 1                        | Same responses, different provider |
