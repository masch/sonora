# SDD Proposal: MercadoPago Payment Integration

**Change**: `mercadopago-payment`
**Project**: Sonora (apps/mobile — Expo SDK 56, apps/api — Hono + Drizzle)
**Date**: 2026-07-11
**Status**: Draft Proposal

---

## 1. Problem Statement

Sonora's experiences (tracks and trips) are currently all free. There's no way to monetize content or offer paid experiences. The data model has a `priceLabel` field but it's purely cosmetic — a text string with no payment logic, no purchase verification, and no integration with a payment provider.

**Current state:**

- All experiences are accessible to everyone without restriction
- `priceLabel` is displayed as plain text but nothing enforces payment
- No user identification (no accounts, no email)
- No payment provider integration
- No purchase records

**What's missing:**

- Flag to mark experiences as free vs paid
- Actual price field (numeric, usable for payment)
- MercadoPago Checkout Pro integration for payment processing
- Purchase verification so a paid experience can only be played after payment
- Email-based purchase persistence (no full account system)

---

## 2. Proposed Solution

Add payment capability to Sonora's experiences using MercadoPago Checkout Pro, with email-based purchase tracking.

### High-Level Flow

```
User taps paid experience (not yet purchased)
        │
        ▼
┌────────────────────────────────┐
│ Show price + email form        │
│ "This experience costs ARS X" │
│ "Enter your email to continue" │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│ Backend creates MP preference  │
│ POST /payments/create          │
│ → Returns checkout URL         │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│ Open MercadoPago Checkout Pro  │
│ (WebBrowser / WebView)         │
│ User completes payment         │
└────────────┬───────────────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌────────────┐  ┌──────────────────────┐
│ MP webhook │  │ App redirects back   │
│ POST /pay-  │  │ → polls payment      │
│ ments/      │  │   status via API     │
│ webhook     │  │ GET /payments/       │
│ → marks     │  │   status/:id         │
│   paid in   │  └──────────┬───────────┘
│   DB        │             │
└──────┬─────┘              │
       │                    │
       └────────┬───────────┘
                ▼
┌────────────────────────────────┐
│ Experience unlocked            │
│ → User can play/download       │
│ → Purchase persisted via email │
└────────────────────────────────┘
```

### Key Principle

**Pay once, play forever.** Payment is tied to (email + experience). Once purchased, that email can access that experience on any device without paying again.

---

## 3. Business Rules & Decisions

| Rule                    | Decision                                              |
| ----------------------- | ----------------------------------------------------- |
| **Payment provider**    | MercadoPago Checkout Pro                              |
| **Currency**            | ARS (Argentine pesos) — fixed per experience          |
| **User identification** | Email only — no password, no full account             |
| **Purchase model**      | Pay-per-experience (individual purchase)              |
| **Persistence**         | Purchase tied to (email, experienceId) in DB          |
| **Free experiences**    | Identified by `free: true` — playable without payment |
| **Paid experiences**    | `free: false` + `price: number` — requires purchase   |
| **Price configuration** | Set via DB seed (admin config), no admin UI           |
| **Play after purchase** | Auto-play after successful payment                    |
| **Refund policy**       | None — handled outside the app via MP                 |
| **Test mode**           | MercadoPago sandbox credentials for development       |

---

## 4. Scope

### What's In

1. **Data model changes**
   - Add `free` (boolean) and `price` (numeric) fields to `Experience` in DB schema
   - Replace `priceLabel` (text) with `price` (number) + `free` flag
   - Add `purchases` table: `id, email, experience_id, payment_id, status, created_at`
   - Update shared types in `packages/shared/src/experiences.ts`
   - Update seed data

2. **Backend: MercadoPago checkout creation**
   - New route `POST /payments/create` — creates MP preference, returns checkout URL
   - Receives: `experienceId`, `email`
   - Returns: `checkoutUrl`, `paymentId`
   - Validates experience exists, is not free, amount matches

3. **Backend: MercadoPago webhook handler**
   - New route `POST /payments/webhook` — receives MP IPN/webhook notifications
   - Validates webhook signature (MP secret)
   - Updates purchase status in DB
   - Handles `payment.approved` status

4. **Backend: Purchase verification**
   - New route `GET /payments/status/:paymentId` — returns payment status
   - New route `GET /experiences/:id/purchased?email=` — checks if email has purchased this experience
   - New route `GET /purchases?email=` — returns all purchases for an email

5. **Mobile: Payment UI flow**
   - When user taps a paid (not purchased) experience: show price + email input
   - "Pay with MercadoPago" button → calls backend → opens Checkout Pro
   - After payment redirect: verify status, auto-play experience
   - Loading/error states for payment flow

6. **Mobile: Purchase verification on load**
   - On experience detail screen load, check if user has purchased it (via stored email + API)
   - If purchased: show play button
   - If not purchased + free: show play button
   - If not purchased + paid: show payment prompt

7. **Mobile: Email storage**
   - Store user email locally (AsyncStorage) after first payment
   - Use stored email for subsequent purchase checks

8. **MercadoPago credentials configuration**
   - Add `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` to API env
   - Sandbox vs production mode

### What's Out (Non-Goals)

- ❌ Full user account system (register/login/password)
- ❌ Admin UI for configuring prices (seed-only for now)
- ❌ Subscription model (pay-per-experience only)
- ❌ Refunds, disputes, cancellations
- ❌ Multiple payment providers (MercadoPago only)
- ❌ Promo codes, discounts, bundles
- ❌ Play Store in-app purchases (Google Play Billing)
- ❌ iOS / Apple Pay
- ❌ Automated receipts/invoices

---

## 5. Technical Details

### Data Model Changes

**DB Schema — experiences table:**

```
- priceLabel (text, nullable)    → REMOVED
- free (boolean, default true)    → ADDED
- price (integer, nullable)       → ADDED (price in ARS cents)
```

**New table: purchases**

```sql
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  experience_id UUID NOT NULL REFERENCES experiences(id),
  payment_id TEXT NOT NULL UNIQUE,  -- MercadoPago payment ID
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | refunded
  amount INTEGER NOT NULL,  -- price paid in ARS cents
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Shared types changes:**

```typescript
export interface BaseExperience {
  // ... existing fields ...
  priceLabel?: string | null; // REMOVED
  free: boolean; // ADDED — true by default
  price?: number | null; // ADDED — price in ARS (or null if free)
}
```

### API Routes

| Method | Path                                | Purpose                             |
| ------ | ----------------------------------- | ----------------------------------- |
| POST   | `/payments/create`                  | Create MP checkout preference       |
| POST   | `/payments/webhook`                 | MP IPN/webhook notification         |
| GET    | `/payments/status/:paymentId`       | Check payment status                |
| GET    | `/experiences/:id/purchased?email=` | Check if email purchased experience |
| GET    | `/purchases?email=`                 | List all purchases for email        |

### MercadoPago Checkout Pro Integration

1. Backend creates a preference via MP API:

   ```
   POST https://api.mercadopago.com/checkout/preferences
   Headers: Authorization: Bearer {ACCESS_TOKEN}
   Body: {
     items: [{ title: "Experience Name", quantity: 1, unit_price: PRICE }],
     payer: { email: "user@example.com" },
     back_urls: {
       success: "sonora://payment/success",
       failure: "sonora://payment/failure",
       pending: "sonora://payment/pending"
     },
     notification_url: "https://api.sonora.app/payments/webhook",
     external_reference: experienceId
   }
   ```

2. Returns `checkoutUrl` from MP response
3. Mobile opens URL via `expo-web-browser` or `Linking`
4. MP redirects back to `sonora://` deep link
5. Mobile polls `GET /payments/status/:paymentId`
6. Webhook updates DB asynchronously

### Mobile Payment Flow

```
User taps paid experience
  → Check stored email
  → If no email stored:
    → Show email input + price
  → If email stored:
    → Show price + "Pay with MercadoPago" button
  → User taps "Pay"
  → POST /payments/create { experienceId, email }
  → Open checkoutUrl via WebBrowser.openAuthSessionAsync
  → User completes/fails/cancels in MP
  → Redirect back to app
  → Poll GET /payments/status/:paymentId (every 2s, max 30s)
  → If approved:
    → Save email to AsyncStorage
    → Show success + auto-play experience
  → If failed/cancelled:
    → Show error message
```

---

## 6. Risks & Mitigations

| Risk                                         | Likelihood | Impact                                          | Mitigation                                                |
| -------------------------------------------- | ---------- | ----------------------------------------------- | --------------------------------------------------------- |
| **Webhook not received / delayed**           | Medium     | Medium — user paid but not unlocked             | Polling fallback + manual retry button                    |
| **User closes browser before redirect**      | High       | Low — payment still goes through via webhook    | Polling mechanism catches it; retry on app reopen         |
| **MP API changes**                           | Low        | High — checkout breaks                          | Use well-documented stable API, pin SDK version           |
| **Email spoofing / unauthorized access**     | Low        | Medium — someone could claim another's purchase | Future: email verification; for now, acceptable risk      |
| **Price mismatch (frontend vs backend)**     | Low        | Medium — user could pay wrong amount            | Server always creates preference with authoritative price |
| **MP sandbox vs production confusion**       | Medium     | High — real payments in dev                     | Separate env vars, clear environment detection            |
| **Free experience accidentally set as paid** | Low        | Low — blocks user access                        | Easy DB fix, seed validation                              |
| **User enters wrong email**                  | Medium     | Medium — can't recover purchase                 | Document: "verify your email" in UI                       |

---

## 7. Rollback Strategy

- **Data model rollback**: Revert migration, restore old `priceLabel` field
- **API rollback**: Remove payment routes, keep existing experience routes untouched
- **Mobile rollback**: Remove payment UI, paid experiences show as free
- **If a bad payment goes through**: Refund via MercadoPago dashboard

---

## 8. Success Criteria

| Criterion                                                  | Verification                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| Free experiences play immediately without email or payment | Load free experience → play button visible                    |
| Paid experience shows price + email form                   | Load paid experience without purchase → price displayed       |
| User can complete MP Checkout Pro payment                  | Full end-to-end payment flow in sandbox                       |
| Purchase persists across app restarts                      | Pay → close app → reopen → experience still unlocked          |
| Same email on another device shows purchase                | Verify via API with same email                                |
| Webhook correctly updates purchase status                  | Pay → check DB → status = 'approved'                          |
| Unpaid experience cannot be played                         | Attempt to play unpaid paid experience → payment prompt shown |

---

## 9. Open Questions

1. Should we validate the email format before sending to MP? (Yes — simple regex)
2. Deep link scheme: is `sonora://` already configured? (Check app config)
3. Should we store the full MP payer ID or just email? (Just email for MVP)
4. Error recovery: if polling times out but payment went through, how does the user recover? (Manual refresh/retry button)
5. Should we add a "Restore Purchases" option? (Yes — via email input in settings)

---

## 10. Dependencies

- MercadoPago developer account (sandbox + production credentials)
- `MERCADO_PAGO_ACCESS_TOKEN` and `MERCADO_PAGO_WEBHOOK_SECRET` configured in API env
- Deep link scheme `sonora://` configured for the mobile app
- `expo-web-browser` or `expo-linking` for Checkout Pro redirects
- MP webhook URL needs to be publicly accessible (production URL)
