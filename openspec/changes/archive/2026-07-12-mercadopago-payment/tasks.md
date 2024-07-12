# Tasks: MercadoPago Payment Integration

**Change**: `mercadopago-payment`
**Date**: 2026-07-11

---

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | ~350           |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No (single PR) |
| Delivery strategy       | single-pr      |

---

## Phase 1: Backend — Payment Provider

### Task 1.1: Create PaymentProvider interface

- **File**: `apps/api/src/payments/provider.ts` (NEW)
- **What**: Define `CheckoutParams`, `CheckoutResult`, `WebhookResult` types and `PaymentProvider` interface
- **Details**: `createCheckout(params)`, `processWebhook(payload, headers)`, `getPaymentStatus(providerPaymentId)`
- **Design ref**: Section 2.1

### Task 1.2: Implement MercadoPagoProvider

- **File**: `apps/api/src/payments/mercadopago.ts` (NEW)
- **What**: Implement `PaymentProvider` for MercadoPago Checkout Pro
- **Details**:
  - `createCheckout`: POST to `/checkout/preferences`, returns `sandbox_init_point || init_point`
  - `processWebhook`: validates MP notification, fetches payment details via `/v1/payments/{id}`
  - `getPaymentStatus`: fetches from `/v1/payments/{id}`
  - Token-driven environment detection (no sandbox flag)
- **Design ref**: Section 2.2, Section 7 (multi-environment)

### Task 1.3: Create provider registry

- **File**: `apps/api/src/payments/index.ts` (NEW)
- **What**: Export `createPaymentProviders(env)` that builds the provider registry
- **Details**: `{ mercadopago: MercadoPagoProvider, stripe: null, paypal: null }`
- **Design ref**: Section 2.3, Section 2.4

---

## Phase 2: Backend — Database Schema

### Task 2.1: Add payment_provider enum and purchases table

- **File**: `apps/api/src/db/schema.ts`
- **What**: Add `payment_provider` enum, `purchases` table, modify `experiences`
- **Details**:
  - ENUM: `'mercadopago' | 'stripe' | 'paypal'`
  - Table: `purchases(id, email, experienceId, provider, providerPaymentId, status, amount, currency, metadata, createdAt, updatedAt)`
  - Modify `experiences`: add `free` (boolean, default true), `price` (integer, nullable), remove `priceLabel`
- **Design ref**: Section 3.2

### Task 2.2: Create DB migration

- **File**: `apps/api/drizzle.config.ts` (or migration scripts)
- **What**: Generate migration for the schema changes
- **Details**: `ALTER TYPE`, `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX`
- **Design ref**: Section 3.1

### Task 2.3: Update seed data

- **File**: `apps/api/src/db/seed.ts`
- **What**: Replace `priceLabel` with `free` + `price` in all experiences
- **Details**:
  - `priceLabel: '15 mil $'` → `free: false, price: 15000`
  - `priceLabel: 'FREE'` → `free: true, price: null`
  - Others → `free: true, price: null`
- **Design ref**: Section 3.3

---

## Phase 3: Backend — Payment Routes

### Task 3.1: Create payments router

- **File**: `apps/api/src/routes/payments.ts` (NEW)
- **What**: Implement all payment routes with provider-agnostic logic
- **Routes**:
  - `POST /payments/create` → checkout creation
  - `POST /payments/webhook` → webhook processing
  - `GET /payments/status/:purchaseId` → status check
  - `GET /experiences/:id/purchased?email=` → purchase verification
  - `GET /purchases?email=` → list purchases
- **Design ref**: Section 4, Section 6

### Task 3.2: Mount payments router in index.ts

- **File**: `apps/api/src/index.ts`
- **What**: Add `app.route('/payments', paymentsRouter)` and inject `paymentProviders` into context
- **Details**: Add `paymentProviders` to `Variables` interface, middleware or per-route injection
- **Design ref**: Section 4

### Task 3.3: Add MP environment variables to .env.example

- **File**: `apps/api/.env.example`
- **What**: Document `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `DEFAULT_PAYMENT_PROVIDER`
- **Design ref**: Section 6.4, Section 7

---

## Phase 4: Backend — Experience Data Update

### Task 4.1: Update shared types

- **File**: `packages/shared/src/experiences.ts`
- **What**: Replace `priceLabel` with `free` + `price` in `BaseExperience`
- **Details**:
  - Remove `priceLabel?: string | null`
  - Add `free: boolean`
  - Add `price?: number | null`
- **Design ref**: Section 3 (spec)

### Task 4.2: Update mobile experience data

- **File**: `apps/mobile/src/data/experiences.ts`
- **What**: Sync types with shared package changes
- **Details**: Re-export updated types, remove `priceLabel` references
- **Design ref**: Section 3 (spec)

---

## Phase 5: Mobile — Payment Client & Hook

### Task 5.1: Create payment API client

- **File**: `apps/mobile/src/services/payment-client.ts` (NEW)
- **What**: Wrapper for payment API calls
- **Methods**:
  - `createPayment(experienceId)` → `{ purchaseId, checkoutUrl }`
  - `getPaymentStatus(purchaseId)` → purchase status
  - `checkPurchased(experienceId, email)` → `{ purchased, purchase? }`
  - `listPurchases(email)` → `{ purchases[] }`
- **Design ref**: Section 5.1

### Task 5.2: Create usePurchase hook

- **File**: `apps/mobile/src/hooks/use-purchase.ts` (NEW)
- **What**: Hook managing purchase state and actions
- **State machine**: `loading → free | paid | purchased | error`
- **Actions**: `pay()`, `restore(email)`, `refresh()`
- **Details**:
  - Checks local AsyncStorage cache on mount
  - `pay()`: calls API, opens WebBrowser, polls status
  - `restore(email)`: calls API, caches if found
  - Saves email to AsyncStorage after successful purchase
- **Design ref**: Section 5.1, Section 5.4, Section 5.5

### Task 5.3: Add purchase cache to app-storage

- **File**: `apps/mobile/src/storage/app-storage.ts`
- **What**: Add helpers `getPurchasedIds()`, `addPurchasedId(id)`, `getUserEmail()`, `setUserEmail(email)`
- **Design ref**: Section 5.5

---

## Phase 6: Mobile — Payment UI

### Task 6.1: Add i18n strings

- **Files**: `apps/mobile/src/i18n/locales/es.ts`, `apps/mobile/src/i18n/locales/en.ts`
- **What**: New translation keys for payment flow
- **Strings needed**:
  - `payments.price.ars`: "ARS {{amount}}"
  - `payments.pay`: "Pagar con MercadoPago"
  - `payments.restore.title`: "Restaurar compras"
  - `payments.restore.description`: "Ingresá el email que usaste para comprar esta experiencia"
  - `payments.restore.button`: "Restaurar"
  - `payments.restore.notFound`: "No se encontraron compras para este email"
  - `payments.restore.success`: "Compras restauradas correctamente"
  - `payments.pending`: "Pago pendiente"
  - `payments.checkStatus`: "Verificar estado del pago"
  - `payments.error.create`: "No se pudo iniciar el pago. Reintentá."
  - `payments.paid.label`: "Esta experiencia es una experiencia paga"
  - `payments.restore.link`: "¿Ya la compraste? Restaurar compras"

### Task 6.2: Create PaymentPrompt component

- **File**: `apps/mobile/src/components/payment-prompt.tsx` (NEW)
- **What**: UI component showing price + pay/restore buttons
- **Props**: `price`, `currency`, `onPay`, `onRestore`, `loading`, `error`
- **Design ref**: Section 5.2, Section 5.4

### Task 6.3: Add payment flow to TrackDetailView

- **File**: `apps/mobile/src/components/track-detail-view.tsx`
- **What**:
  - Import and use `usePurchase` hook
  - Add `PaymentPrompt` between title/metadata and audio controls
  - Add `BottomModal` for restore flow
  - Conditionally show play button based on purchase state
- **Design ref**: Section 5.2

### Task 6.4: Add payment flow to TripDetailView

- **File**: `apps/mobile/src/components/trip-detail-view.tsx`
- **What**: Same changes as TrackDetailView
- **Design ref**: Section 5.2

### Task 6.5: Add deep link handler in app layout

- **File**: `apps/mobile/src/app/_layout.tsx`
- **What**: Listen for deep links (`sonora://payment/*`) to trigger status polling after MP redirect
- **Design ref**: Section 6.2

---

## Task Summary

| ID  | Task                       | Files                                              | Effort | Dependencies |
| --- | -------------------------- | -------------------------------------------------- | ------ | ------------ |
| 1.1 | PaymentProvider interface  | `apps/api/src/payments/provider.ts`                | Small  | —            |
| 1.2 | MercadoPagoProvider        | `apps/api/src/payments/mercadopago.ts`             | Medium | 1.1          |
| 1.3 | Provider registry          | `apps/api/src/payments/index.ts`                   | Small  | 1.2          |
| 2.1 | DB schema changes          | `apps/api/src/db/schema.ts`                        | Small  | —            |
| 2.2 | DB migration               | `apps/api/drizzle.config.ts`                       | Small  | 2.1          |
| 2.3 | Update seed data           | `apps/api/src/db/seed.ts`                          | Small  | 2.1          |
| 3.1 | Payments router            | `apps/api/src/routes/payments.ts`                  | Large  | 1.3, 2.1     |
| 3.2 | Mount router in index.ts   | `apps/api/src/index.ts`                            | Small  | 3.1          |
| 3.3 | .env.example               | `apps/api/.env.example`                            | Small  | —            |
| 4.1 | Shared types update        | `packages/shared/src/experiences.ts`               | Small  | —            |
| 4.2 | Mobile data sync           | `apps/mobile/src/data/experiences.ts`              | Small  | 4.1          |
| 5.1 | Payment client service     | `apps/mobile/src/services/payment-client.ts`       | Small  | —            |
| 5.2 | usePurchase hook           | `apps/mobile/src/hooks/use-purchase.ts`            | Medium | 5.1, 5.3     |
| 5.3 | App-storage helpers        | `apps/mobile/src/storage/app-storage.ts`           | Small  | —            |
| 6.1 | i18n strings               | i18n locale files                                  | Small  | —            |
| 6.2 | PaymentPrompt component    | `apps/mobile/src/components/payment-prompt.tsx`    | Small  | 6.1          |
| 6.3 | TrackDetailView payment UI | `apps/mobile/src/components/track-detail-view.tsx` | Medium | 5.2, 6.2     |
| 6.4 | TripDetailView payment UI  | `apps/mobile/src/components/trip-detail-view.tsx`  | Medium | 5.2, 6.2     |
| 6.5 | Deep link handler          | `apps/mobile/src/app/_layout.tsx`                  | Small  | 5.2          |

**Total: 19 tasks — ~350 estimated lines changed**

---

## Rollback Plan

| Component     | Rollback                                                        |
| ------------- | --------------------------------------------------------------- |
| DB schema     | Revert migration (DROP purchases, ALTER experiences, DROP enum) |
| API routes    | Remove payments router, revert index.ts                         |
| Provider code | Delete `apps/api/src/payments/`                                 |
| Mobile files  | Delete new files, revert detail views to originals              |
| i18n          | Remove payment keys from locale files                           |
