# MercadoPago Payment Integration — Technical Design

**Change**: `mercadopago-payment`
**Date**: 2026-07-11

---

## 1. Architecture Overview

```
┌───────────── MOBILE APP ─────────────────────────────────┐
│                                                           │
│  TrackDetailView / TripDetailView                         │
│         │                                                 │
│         ▼                                                 │
│  usePurchase(experienceId)                                  │
│         │                                                 │
│    ┌────┴────┐                                           │
│    │ pay()   │ restore(email)                             │
│    └────┬────┘                                            │
│         │                                                 │
│         ▼                                                 │
│  payment-client.ts → POST /payments/create                 │
│                   → GET /payments/status/:id               │
│                   → GET /experiences/:id/purchased?email=  │
│                                                           │
│  Cache: AsyncStorage → 'purchases' key (Set<experienceId>) │
│                                                           │
└───────────────────────────────────────────────────────────┘
         │                          │
         │ HTTPS                    │ HTTPS
         ▼                          ▼
┌──────────────── BACKEND API ─────────────────────────────┐
│                                                           │
│  POST /payments/create                                    │
│    → router → provider.createCheckout()                   │
│    → inserts purchase (status: pending)                   │
│    → returns { checkoutUrl, purchaseId }                   │
│                                                           │
│  POST /payments/webhook                                   │
│    → router → provider.processWebhook()                   │
│    → updates purchase status + email                       │
│                                                           │
│  GET /payments/status/:purchaseId                          │
│    → returns purchase status from DB                       │
│                                                           │
│  GET /experiences/:id/purchased?email=                     │
│    → checks purchases table for email + experience         │
│                                                           │
│  GET /purchases?email=                                     │
│    → returns all purchases for email                       │
│                                                           │
│  Provider Registry:                                        │
│    mercadopago → MercadoPagoProvider (active)             │
│    stripe     → null (placeholder)                         │
│    paypal     → null (placeholder)                         │
│                                                           │
└───────────────────────────────────────────────────────────┘
         │
         │ HTTPS
         ▼
┌──────────────── EXTERNAL ────────────────────────────────┐
│                                                           │
│  MercadoPago API                                          │
│  → POST /checkout/preferences                             │
│  → Webhook POST /payments/webhook                         │
│                                                           │
│  Future: Stripe API, PayPal API                            │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 2. PaymentProvider Interface & Registry

### 2.1 Interface (`apps/api/src/payments/provider.ts`)

```typescript
export interface CheckoutParams {
  purchaseId: string;
  experienceTitle: string;
  amount: number;
  currency: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  notificationUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  providerPaymentId: string;
}

export interface WebhookResult {
  event: 'payment.approved' | 'payment.rejected' | 'payment.refunded';
  providerPaymentId: string;
  email: string;
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  processWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookResult>;
  getPaymentStatus(providerPaymentId: string): Promise<{
    status: 'approved' | 'pending' | 'rejected';
    email?: string;
    amount?: number;
    currency?: string;
  }>;
}
```

### 2.2 MercadoPagoProvider

```typescript
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago';

  constructor(
    private config: {
      accessToken: string;
      webhookSecret: string;
      sandbox: boolean;
    },
  ) {}

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: params.experienceTitle,
            quantity: 1,
            unit_price: params.amount,
            currency_id: params.currency,
          },
        ],
        external_reference: params.purchaseId,
        back_urls: {
          success: params.backUrls.success,
          failure: params.backUrls.failure,
          pending: params.backUrls.pending,
        },
        notification_url: params.notificationUrl,
        auto_return: 'approved',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MercadoPago checkout error: ${error}`);
    }

    const data = await response.json();
    return {
      checkoutUrl: data.init_point, // or sandbox_init_point
      providerPaymentId: data.id,
    };
  }

  async processWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookResult> {
    const body = payload as any;

    // Only process payment topics
    if (body.type !== 'payment') {
      throw new Error('Ignored non-payment notification');
    }

    // Fetch payment details from MP API
    const paymentId = body.data.id;
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });

    if (!paymentResponse.ok) {
      throw new Error(`Failed to fetch payment ${paymentId}`);
    }

    const payment = await paymentResponse.json();

    return {
      event: this.mapStatus(payment.status),
      providerPaymentId: String(payment.id),
      email: payment.payer?.email || '',
      amount: payment.transaction_amount,
      currency: payment.currency_id || 'ARS',
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<{
    status: 'approved' | 'pending' | 'rejected';
    email?: string;
    amount?: number;
    currency?: string;
  }> {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    const payment = await response.json();
    return {
      status: this.mapStatus(payment.status),
      email: payment.payer?.email,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    };
  }

  private mapStatus(mpStatus: string): 'approved' | 'pending' | 'rejected' {
    switch (mpStatus) {
      case 'approved':
        return 'approved';
      case 'pending':
      case 'in_process':
      case 'in_mediation':
        return 'pending';
      case 'rejected':
      case 'cancelled':
      case 'refunded':
      case 'charged_back':
        return 'rejected';
      default:
        return 'pending';
    }
  }
}
```

### 2.3 Provider Registry

```typescript
import { type PaymentProvider } from './provider';
import { MercadoPagoProvider } from './mercadopago';

export function createPaymentProviders(env: Env): Record<string, PaymentProvider | null> {
  const providers: Record<string, PaymentProvider | null> = {
    mercadopago: new MercadoPagoProvider({
      accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
      webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET || '',
      sandbox: env.ENVIRONMENT !== 'production',
    }),
    stripe: null, // placeholder
    paypal: null, // placeholder
  };
  return providers;
}
```

### 2.4 Default Provider

The default provider (`mercadopago`) is determined by:

1. An `ENV.DEFAULT_PAYMENT_PROVIDER` env var (default: `'mercadopago'`)
2. Validated against the provider registry at startup
3. Used when `POST /payments/create` doesn't specify a provider

---

## 3. Database Schema

### 3.1 Migration: New Enum + Table + Column Changes

```sql
-- New enum for payment providers
CREATE TYPE payment_provider AS ENUM ('mercadopago', 'stripe', 'paypal');

-- Modify experiences table
ALTER TABLE experiences
  ADD COLUMN free boolean NOT NULL DEFAULT true,
  ADD COLUMN price integer,  -- ARS, in cents (or smallest unit)
  DROP COLUMN IF EXISTS price_label;

-- New purchases table
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  provider_payment_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_email ON purchases(email);
CREATE INDEX idx_purchases_experience ON purchases(experience_id);
CREATE INDEX idx_purchases_status ON purchases(status);
```

### 3.2 Drizzle Schema

```typescript
export const paymentProviderEnum = sonoraSchema.enum('payment_provider', [
  'mercadopago',
  'stripe',
  'paypal',
]);

// Modified experiences: remove priceLabel, add free + price
export const experiences = sonoraSchema.table('experiences', {
  // ... existing fields unchanged ...
  // priceLabel: text('price_label'),  ← REMOVED
  free: boolean('free').notNull().default(true),
  price: integer('price'),
  // ... rest unchanged ...
});

export const purchases = sonoraSchema.table('purchases', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email'),
  experienceId: uuid('experience_id')
    .notNull()
    .references(() => experiences.id, { onDelete: 'cascade' }),
  provider: paymentProviderEnum('provider').notNull(),
  providerPaymentId: text('provider_payment_id').notNull().unique(),
  status: text('status').notNull().default('pending'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('ARS'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 3.3 Seed Data Update

Existing seed entries with `priceLabel` values:

| Current                         | New (`free` / `price`)      |
| ------------------------------- | --------------------------- |
| `priceLabel: '15 mil $'` (trip) | `free: false, price: 15000` |
| `priceLabel: 'FREE'` (track)    | `free: true, price: null`   |
| Track without priceLabel        | `free: true, price: null`   |

---

## 4. API Routes — Implementation Detail

### 4.1 POST /payments/create

```typescript
// apps/api/src/routes/payments.ts

paymentsRouter.post('/create', async (c) => {
  const db = c.var.db;
  const providers = c.var.paymentProviders;
  const { experienceId } = await c.req.json();
  const defaultProvider = c.env.DEFAULT_PAYMENT_PROVIDER || 'mercadopago';

  // Fetch experience
  const [experience] = await db
    .select()
    .from(experiences)
    .where(eq(experiences.id, experienceId))
    .limit(1);

  if (!experience) return c.json({ error: 'Experience not found' }, 404);
  if (experience.free) return c.json({ error: 'Experience is free' }, 400);

  const provider = providers[defaultProvider];
  if (!provider) return c.json({ error: 'Payment provider not available' }, 500);

  // Create purchase record (pending)
  const [purchase] = await db
    .insert(purchases)
    .values({
      experienceId: experience.id,
      provider: defaultProvider,
      providerPaymentId: '', // temporary, updated after checkout
      amount: experience.price,
      currency: 'ARS',
      status: 'pending',
    })
    .returning();

  // Create checkout with provider
  const baseUrl = new URL(c.req.url).origin;
  const result = await provider.createCheckout({
    purchaseId: purchase.id,
    experienceTitle: experience.title,
    amount: experience.price,
    currency: 'ARS',
    backUrls: {
      success: `sonora://payment/success/${purchase.id}`,
      failure: `sonora://payment/failure/${purchase.id}`,
      pending: `sonora://payment/pending/${purchase.id}`,
    },
    notificationUrl: `${baseUrl}/payments/webhook`,
  });

  // Update purchase with provider payment ID
  await db
    .update(purchases)
    .set({ providerPaymentId: result.providerPaymentId, updatedAt: new Date() })
    .where(eq(purchases.id, purchase.id));

  return c.json({
    purchaseId: purchase.id,
    checkoutUrl: result.checkoutUrl,
  });
});
```

### 4.2 POST /payments/webhook

```typescript
paymentsRouter.post('/webhook', async (c) => {
  const db = c.var.db;
  const providers = c.var.paymentProviders;
  const payload = await c.req.json();
  const headers = Object.fromEntries(c.req.raw.headers.entries());

  // Determine provider from payload or URL
  // MP webhook includes type and data.id
  const providerName = detectProviderFromPayload(payload, headers);
  const provider = providers[providerName];

  if (!provider) return c.json({ error: 'Unknown provider' }, 400);

  // Process webhook
  const result = await provider.processWebhook(payload, headers);

  // Update purchase
  const [purchase] = await db
    .update(purchases)
    .set({
      status:
        result.event === 'payment.approved'
          ? 'approved'
          : result.event === 'payment.rejected'
            ? 'rejected'
            : result.event === 'payment.refunded'
              ? 'refunded'
              : 'pending',
      email: result.email || undefined,
      updatedAt: new Date(),
    })
    .where(eq(purchases.providerPaymentId, result.providerPaymentId))
    .returning();

  if (!purchase) return c.json({ error: 'Purchase not found' }, 404);

  return c.json({ status: 'ok' });
});
```

### 4.3 GET /payments/status/:purchaseId

```typescript
paymentsRouter.get('/status/:purchaseId', async (c) => {
  const db = c.var.db;
  const { purchaseId } = c.req.param();

  const [purchase] = await db.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);

  if (!purchase) return c.json({ error: 'Purchase not found' }, 404);

  return c.json({
    purchaseId: purchase.id,
    status: purchase.status,
    experienceId: purchase.experienceId,
    provider: purchase.provider,
    amount: purchase.amount,
    currency: purchase.currency,
  });
});
```

### 4.4 GET /experiences/:id/purchased?email=

```typescript
paymentsRouter.get('/experiences/:id/purchased', async (c) => {
  const db = c.var.db;
  const { id } = c.req.param();
  const email = c.req.query('email');

  if (!email) return c.json({ error: 'Email is required' }, 400);

  const [purchase] = await db
    .select()
    .from(purchases)
    .where(
      and(
        eq(purchases.experienceId, id),
        eq(purchases.email, email),
        eq(purchases.status, 'approved'),
      ),
    )
    .limit(1);

  if (!purchase) {
    return c.json({ purchased: false });
  }

  return c.json({
    purchased: true,
    purchase: {
      purchaseId: purchase.id,
      status: purchase.status,
      provider: purchase.provider,
      amount: purchase.amount,
      currency: purchase.currency,
      purchasedAt: purchase.createdAt,
    },
  });
});
```

### 4.5 GET /purchases?email=

```typescript
paymentsRouter.get('/', async (c) => {
  const db = c.var.db;
  const email = c.req.query('email');

  if (!email) return c.json({ error: 'Email is required' }, 400);

  const list = await db
    .select({
      purchaseId: purchases.id,
      experienceId: purchases.experienceId,
      experienceTitle: experiences.title,
      experienceSlug: experiences.slug,
      status: purchases.status,
      provider: purchases.provider,
      amount: purchases.amount,
      currency: purchases.currency,
      purchasedAt: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(experiences, eq(purchases.experienceId, experiences.id))
    .where(and(eq(purchases.email, email), eq(purchases.status, 'approved')));

  return c.json({ purchases: list });
});
```

---

## 5. Mobile: Component Architecture

### 5.1 usePurchase Hook

```typescript
// apps/mobile/src/hooks/use-purchase.ts

interface PurchaseState {
  status: 'loading' | 'free' | 'paid' | 'purchased' | 'error';
  free: boolean;
  price: number | null;
  purchaseId: string | null;
}

interface PurchaseActions {
  pay: () => Promise<void>;
  restore: (email: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

function usePurchase(experienceId: string): [PurchaseState, PurchaseActions] {
  // 1. On mount: check local cache (AsyncStorage) for purchased IDs
  // 2. If cached → status = 'purchased'
  // 3. If not cached → fetch experience metadata (free + price from API)
  //    → if free → status = 'free'
  //    → if paid, check local email from storage → call GET /experiences/:id/purchased
  //      → if purchased → status = 'purchased', save to cache
  //      → if not → status = 'paid'
  // pay():
  //   1. POST /payments/create → { checkoutUrl, purchaseId }
  //   2. Open checkoutUrl via WebBrowser.openAuthSessionAsync
  //   3. On return: poll GET /payments/status/:purchaseId (2s interval, 30s max)
  //   4. If approved: save to local cache, set status = 'purchased'
  //   5. If timeout: show "pending" with retry button
  // restore(email):
  //   1. GET /experiences/:id/purchased?email=
  //   2. If purchased: save to local cache, set status = 'purchased', return true
  //   3. If not: return false
  // refresh():
  //   1. Clear local cache for this experience
  //   2. Re-run the on-mount logic
}
```

### 5.2 Payment UI Integration in Detail Views

The detail views (`TrackDetailView`, `TripDetailView`) currently show a play button, download controls, and feedback form.

**Payment state machine:**

```
[loading] → show spinner
[free]    → show play button (current behavior, unchanged)
[purchased] → show play button
[paid]    → show payment prompt (price + "Pay" + "Restore")
[error]   → show error + retry
```

**Where the payment prompt goes:**

Both `TrackDetailView` and `TripDetailView` render in this order:

1. Image header
2. Title + description + metadata
3. **→ Payment prompt (if paid + not purchased)** ← NEW
4. Download/Audio controls
5. Feedback form
6. Map (trip only)

The payment prompt is a new sub-component:

```typescript
// apps/mobile/src/components/payment-prompt.tsx

interface PaymentPromptProps {
  price: number;
  currency: string;
  onPay: () => void;
  onRestore: () => void;
  loading?: boolean;
  error?: string | null;
}
```

### 5.3 Restore Bottom Modal

Uses the existing `BottomModal` component:

```typescript
// Inside the detail view
const [showRestoreModal, setShowRestoreModal] = useState(false);

// In JSX:
<BottomModal
  visible={showRestoreModal}
  onDismiss={() => setShowRestoreModal(false)}
>
  <RestoreContent
    onRestore={async (email) => {
      const result = await restore(email);
      if (result) {
        setShowRestoreModal(false);
        // Experience unlocked, UX automático
      } else {
        setRestoreError(t('payments.restore.notFound'));
      }
    }}
  />
</BottomModal>
```

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
│  │  Restaurar ⟶             │    │
│  └──────────────────────────┘    │
│                                  │
│  [Cancelar]                      │
│                                  │
└──────────────────────────────────┘
```

### 5.4 Payment Flow Detail

```
User taps paid experience (not purchased)
         │
         ▼
┌────────────────────────────────┐
│ TrackDetailView renders         │
│ → usePurchase → status: 'paid' │
│ → shows PaymentPrompt below     │
│   title/metadata                │
│                                 │
│  ┌─── PaymentPrompt ──────┐    │
│  │ Esta experiencia es     │    │
│  │ una experiencia paga    │    │
│  │                        │    │
│  │ ARS 1.500              │    │
│  │                        │    │
│  │ [Pagar con MercadoPago]│    │
│  │ [Restaurar compras]    │    │
│  └────────────────────────┘    │
└────────────┬───────────────────┘
             │ User taps "Pagar"
             ▼
┌────────────────────────────────┐
│ 1. pay() → POST /payments/create│
│ 2. Shows loading spinner        │
│ 3. Opens WebBrowser             │
│ 4. User pays/MP redirects       │
│ 5. Polls status (2s/30s max)    │
│ 6. On approved:                 │
│    - Saves to AsyncStorage      │
│    - Updates status → 'purchased'│
│    - Shows play button           │
│                                 │
│ On timeout: "Pago pendiente"    │
│ [Check payment status] button   │
└─────────────────────────────────┘
```

### 5.5 Local Purchase Cache

```typescript
// apps/mobile/src/storage/app-storage.ts
// Add these keys:

const PURCHASED_EXPERIENCES_KEY = 'purchased_experiences';
const USER_EMAIL_KEY = 'user_email';

async function getPurchasedIds(): Promise<Set<string>> {
  const raw = await storage.getItem(PURCHASED_EXPERIENCES_KEY);
  return new Set(raw ? JSON.parse(raw) : []);
}

async function addPurchasedId(id: string): Promise<void> {
  const ids = await getPurchasedIds();
  ids.add(id);
  await storage.setItem(PURCHASED_EXPERIENCES_KEY, JSON.stringify([...ids]));
}

async function getUserEmail(): Promise<string | null> {
  return storage.getItem(USER_EMAIL_KEY);
}

async function setUserEmail(email: string): Promise<void> {
  await storage.setItem(USER_EMAIL_KEY, email);
}
```

The local email is saved after a successful purchase (captured from the purchase API response or entered during restore flow). It's used to pre-fill the restore modal.

---

## 6. MercadoPago Integration Details

### 6.1 Checkout Pro Flow

```
Mobile App                    Backend                    MercadoPago
    │                            │                          │
    │  POST /payments/create     │                          │
    │  { experienceId }          │                          │
    │ ─────────────────────────> │                          │
    │                            │  POST /checkout/preferences
    │                            │ ───────────────────────> │
    │                            │                          │
    │                            │  { id, init_point }       │
    │                            │ <─────────────────────── │
    │  { purchaseId, checkoutUrl }│                          │
    │ <───────────────────────── │                          │
    │                            │                          │
    │  WebBrowser.openAuthSessionAsync(checkoutUrl)          │
    │ ───────────────────────────────────────────────────> │
    │                            │                          │
    │              (user pays in MP)                        │
    │                            │                          │
    │  Redirect back (deep link) │                          │
    │ <──────────────────────────────────────────────────── │
    │                            │                          │
    │  POST /payments/webhook    │                          │
    │  (webhook, async)          │                          │
    │ ─────────────────────────> │                          │
    │                            │  Update purchase          │
    │                            │                          │
    │  GET /payments/status/:id  │                          │
    │ (polling, 2s)              │                          │
    │ ─────────────────────────> │                          │
    │  { status: 'approved' }    │                          │
    │ <───────────────────────── │                          │
    │                            │                          │
    │  ✅ Experience unlocked    │                          │
```

### 6.2 Deep Link Configuration

The app receives redirects via deep links:

```
sonora://payment/success/{purchaseId}
sonora://payment/failure/{purchaseId}
sonora://payment/pending/{purchaseId}
```

The app's `_layout.tsx` needs a deep link handler using `expo-linking`:

```typescript
// In app/_layout.tsx or a new hook
useEffect(() => {
  const subscription = Linking.addEventListener('url', (event) => {
    const url = new URL(event.url);
    if (url.pathname.startsWith('/payment/')) {
      const purchaseId = url.pathname.split('/').pop();
      // Trigger status polling for this purchaseId
      handlePaymentRedirect(purchaseId);
    }
  });
  return () => subscription.remove();
}, []);
```

### 6.3 Webhook URL

The `notification_url` sent to MP must be publicly accessible. In production:

```
https://api.sonora.app/payments/webhook
```

In development, use a tunnel (e.g., ngrok, Cloudflare Tunnel) pointing to the local API server.

### 6.4 Required Environment Variables

```bash
# MercadoPago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxxx
MERCADO_PAGO_WEBHOOK_SECRET=your_webhook_secret

# Optional
DEFAULT_PAYMENT_PROVIDER=mercadopago
```

---

## 7. Multi-Environment Provider Strategy

### 7.1 Per-Environment Credentials

Each environment (staging, production) has its own set of MercadoPago credentials, stored as GitHub Environment Secrets.

| Environment    | Access Token                | Behavior                                             |
| -------------- | --------------------------- | ---------------------------------------------------- |
| **Staging**    | `TEST-xxxx` (Sandbox)       | Uses `sandbox_init_point`, test cards, no real money |
| **Production** | `APP_USR-xxxx` (Production) | Uses `init_point`, real payments                     |

### 7.2 Token-Driven Environment Detection

The access token itself determines the environment — no separate flag needed:

```typescript
class MercadoPagoProvider implements PaymentProvider {
  private apiUrl = 'https://api.mercadopago.com';

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const response = await fetch(`${this.apiUrl}/checkout/preferences`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: JSON.stringify({/* ... */}),
    });
    const data = await response.json();

    // MP returns sandbox_init_point for TEST tokens, init_point for APP_USR tokens
    return {
      checkoutUrl: data.sandbox_init_point || data.init_point,
      providerPaymentId: data.id,
    };
  }
}
```

### 7.3 Webhook Isolation

Each environment has its own publicly accessible URL:

| Environment | Webhook URL                                       |
| ----------- | ------------------------------------------------- |
| Staging     | `https://api-staging.sonora.app/payments/webhook` |
| Production  | `https://api.sonora.app/payments/webhook`         |

In the MercadoPago dashboard, two webhook notifications are configured — one per environment.

### 7.4 GitHub Actions Secrets

Following the same pattern as existing secrets (Firebase, keystore):

**Staging environment:**

- `MERCADO_PAGO_ACCESS_TOKEN` = `TEST-xxxx` (sandbox)
- `MERCADO_PAGO_WEBHOOK_SECRET` = sandbox webhook secret

**Production environment:**

- `MERCADO_PAGO_ACCESS_TOKEN` = `APP_USR-xxxx` (real)
- `MERCADO_PAGO_WEBHOOK_SECRET` = production webhook secret

### 7.5 Testing with Sandbox

In staging, users can test the full payment flow using MercadoPago test cards:

| Card                                  | Result                |
| ------------------------------------- | --------------------- |
| `4242 4242 4242 4242`                 | Approved payment      |
| `4509 9535 6623 3704`                 | Rejected payment      |
| Any expiry > today, any CVV, any name | Varies by card number |

This allows full end-to-end testing in the staging environment without real money.

### 7.6 Provider Construction

```typescript
export function createPaymentProviders(env: Env): Record<string, PaymentProvider | null> {
  const providers: Record<string, PaymentProvider | null> = {
    mercadopago: new MercadoPagoProvider({
      accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
      webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET || '',
      // No sandbox flag — the access token (TEST vs APP_USR) determines it
    }),
    stripe: null,
    paypal: null,
  };
  return providers;
}
```

The `sandbox` property is removed from the config — the access token is the single source of truth for environment.

## 9. Error Handling & Edge Cases

| Scenario                                                  | Handling                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| MP API down during checkout creation                      | Return 502, show "Payment service unavailable" in app, retry button                       |
| Webhook arrives before polling starts                     | Polling will catch it on first request (status already approved)                          |
| Webhook never arrives                                     | Polling timeout → "Payment pending" with retry. User can also use restore flow.           |
| User closes browser before redirect                       | Payment still goes through. Polling catches it. If polling times out, restore flow works. |
| Duplicate webhook                                         | Idempotent: update on `providerPaymentId` + conditional status change                     |
| Invalid webhook signature                                 | Return 401, no DB changes                                                                 |
| Email not in webhook payload                              | Purchase saved without email → user can restore via email input                           |
| User pays twice for same experience                       | Both purchases in DB. Second one is redundant but harmless. Restore checks latest.        |
| Free experience misconfigured (price > 0 but free: false) | Pay button shown. Admin mistake, fixed in seed.                                           |
| Network lost during payment                               | Polling fails → retry button. Webhook still processes async.                              |
| Purchase status 'pending' after 30s                       | Show "Payment pending" + manual "Check status" button that calls the poll again           |

---

## 10. Security Considerations

| Threat                   | Mitigation                                                             |
| ------------------------ | ---------------------------------------------------------------------- |
| MP access token leaked   | Environment variable only, never logged, never in repo                 |
| Webhook spoofing         | Validate webhook signature per provider (MP uses `x-signature` header) |
| Price tampering (client) | Backend always uses authoritative price from DB, never from client     |
| Email spoofing (restore) | Acceptable for MVP. Future: email verification via magic link          |
| Replay attack on webhook | Idempotent update by `providerPaymentId`                               |
| Deep link hijacking      | Verify purchaseId exists and belongs to expected flow                  |

---

## 11. Decision Log

| Decision            | Choice                                | Alternative                   | Rationale                                                        |
| ------------------- | ------------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| Payment abstraction | Interface + registry                  | Switch-case on provider       | Open/closed principle — new providers don't change existing code |
| Webhook flow        | Provider processes, router updates DB | Router dispatches by provider | Provider encapsulates its own API logic                          |
| Price storage       | Integer (ARS cents)                   | Float                         | Avoid floating-point precision issues                            |
| Payment polling     | Client-side, 2s interval, 30s timeout | Server-Sent Events            | Simpler, no extra infra, works with mobile lifecycle             |
| Deep link scheme    | `sonora://` custom scheme             | Universal links               | Simpler setup, works on both platforms                           |
| Restore email input | BottomModal from detail view          | Settings screen               | Faster UX — user restores in context of the experience they want |
| Local cache         | Set of experience IDs in AsyncStorage | Full purchase objects         | Smaller, simpler, no stale data risk                             |
