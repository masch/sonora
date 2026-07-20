import { type AccessSource, logger, type PurchaseStatus } from '@sonora/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { experienceAccesses, experiences, purchases } from '../db/schema';
import type { Env, Variables } from '../index';
import { createPaymentProviders } from '../payments';

// Valid status transitions from Mercado Pago webhooks.
// MP never sends approved after refunded for the same payment.
const VALID_WEBHOOK_TRANSITIONS: Record<string, string[]> = {
  pending: ['approved', 'rejected'],
  approved: ['refunded'],
};

type WebhookStatus = 'approved' | 'rejected' | 'refunded' | 'pending';

/**
 * Map a Mercado Pago webhook event to a final purchase status.
 * `pending` events mean the payment didn't complete — normalized to `rejected`.
 */
export function mapWebhookEventToStatus(event: PurchaseStatus): WebhookStatus {
  const EVENT_TO_STATUS: Record<PurchaseStatus, WebhookStatus> = {
    approved: 'approved',
    rejected: 'rejected',
    refunded: 'refunded',
    pending: 'pending',
  };
  return EVENT_TO_STATUS[event];
}

const paymentsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /payments/create — Create a checkout session
paymentsRouter.post('/create', async (c) => {
  const db = c.var.db;
  const providers = createPaymentProviders(c.env);
  const defaultProvider = (c.env.DEFAULT_PAYMENT_PROVIDER || 'mercadopago') as
    'mercadopago' | 'stripe' | 'paypal';

  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }

  const { experienceId, redirectUrl } = await c.req.json<{
    experienceId: string;
    redirectUrl?: string;
  }>();

  // Fetch experience
  const [experience] = await db
    .select()
    .from(experiences)
    .where(eq(experiences.id, experienceId))
    .limit(1);

  if (!experience) {
    return c.json({ error: 'Experience not found' }, 404);
  }

  if (experience.free) {
    return c.json({ error: 'Experience is free' }, 400);
  }

  if (!experience.price) {
    return c.json({ error: 'Experience has no price set' }, 400);
  }

  const provider = providers?.[defaultProvider];
  if (!provider) {
    return c.json({ error: 'Payment provider not available' }, 500);
  }

  // Create purchase record (pending) with redirectUrl in metadata
  const [purchase] = await db
    .insert(purchases)
    .values({
      experienceId: experience.id,
      provider: defaultProvider,
      providerPaymentId: `pending-${crypto.randomUUID()}`,
      amount: experience.price,
      currency: 'ARS',
      status: 'pending',
      metadata: redirectUrl ? { redirectUrl } : undefined,
      deviceId: c.var.deviceId,
    })
    .returning();

  // Determine base URL for MP back_urls (must be HTTPS for auto_return)
  let baseUrl: string;
  try {
    baseUrl = new URL(c.req.url).origin;
  } catch {
    baseUrl = '';
  }

  // Store the original redirect URL in purchase metadata so the return
  // endpoints can 302 the browser back to the app's deep link.
  const finalBackUrls = {
    success: `${baseUrl}/payments/return/success/${purchase.id}`,
    failure: `${baseUrl}/payments/return/failure/${purchase.id}`,
    pending: `${baseUrl}/payments/return/pending/${purchase.id}`,
  };

  const result = await provider.createCheckout({
    purchaseId: purchase.id,
    experienceTitle: experience.title,
    amount: experience.price,
    currency: 'ARS',
    backUrls: finalBackUrls,
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

// POST /payments/webhook — Handle payment provider notifications
paymentsRouter.post('/webhook', async (c) => {
  const db = c.var.db;
  const providers = createPaymentProviders(c.env);

  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }

  const rawBody = await c.req.text();
  const payload = JSON.parse(rawBody);
  const headers = Object.fromEntries(c.req.raw.headers.entries());
  const dataId = c.req.query('data.id');

  if (!dataId) {
    return c.json({ error: 'Missing data.id' }, 400);
  }

  // Determine provider from payload or headers
  const providerName = detectProviderFromPayload(payload, headers);
  const provider = providers?.[providerName];

  if (!provider) {
    return c.json({ error: 'Unknown payment provider' }, 400);
  }

  // Process webhook
  const result = await provider.processWebhook(payload, headers, dataId);

  if (!result.externalReference) {
    logger.error('[WEBHOOK] Missing external_reference in webhook result', {
      providerPaymentId: result.providerPaymentId,
      event: result.event,
    });
    return c.json({ error: 'Missing purchase reference' }, 400);
  }

  // Map webhook event to purchase status
  const newStatus = mapWebhookEventToStatus(result.event);

  // Look up our purchase by UUID (external_reference is our purchase ID set at checkout)
  const [existing] = await db
    .select({ status: purchases.status })
    .from(purchases)
    .where(eq(purchases.id, result.externalReference))
    .limit(1);

  if (existing) {
    if (existing.status === newStatus) {
      // MP retry — same status, already processed
      logger.info('[WEBHOOK] Duplicate notification — already processed', {
        purchaseId: result.externalReference,
        providerPaymentId: result.providerPaymentId,
        event: result.event,
        status: newStatus,
        'x-request-id': headers['x-request-id'],
      });
      return c.json({ status: 'ok' });
    }

    if (!VALID_WEBHOOK_TRANSITIONS[existing.status]?.includes(newStatus)) {
      // Invalid transition — possible replay attack
      logger.warn('[METRIC:invalid_webhook_transition_total] Invalid webhook transition rejected', {
        purchaseId: result.externalReference,
        providerPaymentId: result.providerPaymentId,
        from: existing.status,
        attempted: newStatus,
        'x-request-id': headers['x-request-id'] || 'unknown',
        reason: `${existing.status} → ${newStatus} is not a valid MP transition`,
      });
      return c.json({ status: 'ok' });
    }
  }

  // Update purchase by our UUID, storing the real MP payment ID
  const [purchase] = await db
    .update(purchases)
    .set({
      status: newStatus,
      providerPaymentId: result.providerPaymentId,
      email: result.email || undefined,
      metadata: result.metadata || undefined,
      updatedAt: new Date(),
    })
    .where(eq(purchases.id, result.externalReference))
    .returning();

  if (!purchase) {
    return c.json({ error: 'Purchase not found' }, 404);
  }

  return c.json({ status: 'ok' });
});

// GET /payments/return/:status/:purchaseId — Redirect browser back to app after MP checkout
// These endpoints receive the user after MP payment and send them back to the app's deep link.
paymentsRouter.get('/return/:status/:purchaseId', async (c) => {
  const { status: _status, purchaseId } = c.req.param();
  const db = c.var.db;

  // Look up redirectUrl stored in purchase metadata
  if (db) {
    try {
      const [purchase] = await db
        .select({ metadata: purchases.metadata })
        .from(purchases)
        .where(eq(purchases.id, purchaseId))
        .limit(1);

      if (purchase?.metadata) {
        const meta = purchase.metadata as { redirectUrl?: string };
        if (meta.redirectUrl) {
          return c.redirect(meta.redirectUrl, 302);
        }
      }
    } catch {
      // DB error — proceed with default redirect
    }
  }

  // Fallback: redirect to referer origin or root
  const referer = c.req.header('Referer');
  if (referer) {
    try {
      const origin = new URL(referer).origin;
      return c.redirect(origin, 302);
    } catch {
      // Invalid referer — proceed with default
    }
  }

  return c.redirect('/', 302);
});

// GET /payments/status/:purchaseId — Check purchase status (with optional active fallback polling)
paymentsRouter.get('/status/:purchaseId', async (c) => {
  const db = c.var.db;
  const { purchaseId } = c.req.param();
  const shouldSync = c.req.query('sync') === 'true';

  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }

  const [purchase] = await db.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);

  if (!purchase) {
    return c.json({ error: 'Purchase not found' }, 404);
  }

  // Active status synchronization fallback (triggered optionally via ?sync=true)
  if (
    shouldSync &&
    purchase.status === 'pending' &&
    purchase.providerPaymentId &&
    !purchase.providerPaymentId.startsWith('pending-')
  ) {
    try {
      const providers = createPaymentProviders(c.env);
      const provider = providers?.[purchase.provider as 'mercadopago' | 'stripe' | 'paypal'];
      if (provider) {
        const mpStatus = await provider.getPaymentStatus(purchase.providerPaymentId, purchase.id);
        if (mpStatus.status !== 'pending') {
          const [updated] = await db
            .update(purchases)
            .set({
              status: mpStatus.status,
              email: mpStatus.email || undefined,
              updatedAt: new Date(),
            })
            .where(eq(purchases.id, purchase.id))
            .returning();
          if (updated) {
            purchase.status = updated.status;
            purchase.email = updated.email;
          }
        }
      }
    } catch (error) {
      console.error('Active payment status fallback check failed:', error);
    }
  }

  return c.json({
    purchaseId: purchase.id,
    status: purchase.status,
    experienceId: purchase.experienceId,
    provider: purchase.provider,
    amount: purchase.amount,
    currency: purchase.currency,
    email: purchase.email,
  });
});

// GET /experiences/:id/purchased?email= — Check if email purchased an experience
paymentsRouter.get('/experiences/:id/purchased', async (c) => {
  const db = c.var.db;
  const { id } = c.req.param();
  const email = c.req.query('email');

  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

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

// GET /purchases?email= — List all purchases for an email
paymentsRouter.get('/', async (c) => {
  const db = c.var.db;
  const email = c.req.query('email');

  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

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

/**
 * Detect which payment provider a webhook payload belongs to.
 * MP webhooks have { type: "payment", data: { id: "..." } }.
 * Future providers can be detected by different payload structures or headers.
 */
function detectProviderFromPayload(payload: unknown, _headers: Record<string, string>): string {
  const body = payload as { type?: string };
  if (body.type === 'payment') {
    return 'mercadopago';
  }
  // Future: detect Stripe (stripe-signature header), PayPal (event_type field)
  return 'mercadopago';
}

// POST /experiences/:id/access — Log experience access (fire-and-forget from mobile)
paymentsRouter.post('/experiences/:id/access', async (c) => {
  const db = c.var.db;
  const { id } = c.req.param();
  const { source, email, platform } = (await c.req.json()) as {
    source: AccessSource;
    email?: string;
    platform?: string;
  };

  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }

  const deviceId = c.var.deviceId;
  if (!deviceId) {
    return c.json({ error: 'Device ID is required' }, 400);
  }

  // Get current price for snapshot
  const [experience] = await db
    .select({ price: experiences.price })
    .from(experiences)
    .where(eq(experiences.id, id))
    .limit(1);

  await db.insert(experienceAccesses).values({
    experienceId: id,
    email: email ?? null,
    deviceId,
    source,
    priceAtAccess: experience?.price ?? null,
    platform: (platform ?? null) as 'ios' | 'android' | 'web' | null,
  });

  return c.json({ status: 'ok' }, 201);
});

export { paymentsRouter };
