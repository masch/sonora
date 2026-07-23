import { zValidator } from '@hono/zod-validator';
import {
  z,
  CreatePaymentBodySchema,
  EmailQuerySchema,
  LogAccessBodySchema,
  logger,
  WebhookBodySchema,
  PAYMENT_ROUTES,
  type PurchaseStatus,
} from '@sonora/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { experienceAccesses, experiences, purchases } from '../db/schema';
import type { Env, Variables } from '../index';
import { ERRORS, problem, created, HTTP, success } from '../middleware/problem-details';
import { validationHook } from '../middleware/validation-error';
import { dbGuard } from '../middleware/db-guard';
import { deviceIdGuard } from '../middleware/device-id-guard';
import { paymentsGuard } from '../middleware/payments-guard';

const ReturnParamSchema = z.object({
  status: z.string(),
  purchaseId: z.string().min(1),
});

const PurchaseIdParamSchema = z.object({
  purchaseId: z.string().min(1),
});

const IdParamSchema = z.object({
  id: z.string().min(1),
});

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

paymentsRouter.use('*', paymentsGuard());

// POST /payments/create — Create a checkout session
paymentsRouter.post(
  '/create',
  dbGuard(),
  zValidator('json', CreatePaymentBodySchema, validationHook),
  async (c) => {
    const db = c.var.db;
    const providers = c.var.paymentProviders;
    const defaultProvider = c.var.defaultPaymentProvider;

    const { experienceId, redirectUrl } = c.req.valid('json') as {
      experienceId: string;
      redirectUrl?: string;
    };

    // Fetch experience
    const [experience] = await db
      .select()
      .from(experiences)
      .where(eq(experiences.id, experienceId))
      .limit(1);

    if (!experience) {
      return problem(c, ERRORS.EXPERIENCE_NOT_FOUND);
    }

    if (experience.free) {
      return problem(c, ERRORS.EXPERIENCE_IS_FREE);
    }

    if (!experience.price) {
      return problem(c, ERRORS.NO_PRICE_SET);
    }

    const provider = providers?.[defaultProvider];
    if (!provider) {
      return problem(c, ERRORS.PAYMENT_PROVIDER);
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
    } catch (error) {
      logger.warn('[PAYMENTS] Failed to parse request URL origin for backUrls', { error });
      baseUrl = '';
    }

    // Store original redirect URL in purchase metadata and log payment creation details
    logger.info('[PAYMENTS] Creating payment checkout', {
      purchaseId: purchase.id,
      experienceId: experience.id,
      receivedRedirectUrl: redirectUrl,
    });

    const finalBackUrls = {
      success: `${baseUrl}${PAYMENT_ROUTES.returnStatus('success', purchase.id)}`,
      failure: `${baseUrl}${PAYMENT_ROUTES.returnStatus('failure', purchase.id)}`,
      pending: `${baseUrl}${PAYMENT_ROUTES.returnStatus('pending', purchase.id)}`,
    };

    const result = await provider.createCheckout({
      purchaseId: purchase.id,
      experienceTitle: experience.title,
      amount: experience.price,
      currency: 'ARS',
      backUrls: finalBackUrls,
      notificationUrl: `${baseUrl}${PAYMENT_ROUTES.WEBHOOK}`,
    });

    // Update purchase with provider payment ID
    await db
      .update(purchases)
      .set({ providerPaymentId: result.providerPaymentId, updatedAt: new Date() })
      .where(eq(purchases.id, purchase.id));

    return success(c, {
      purchaseId: purchase.id,
      checkoutUrl: result.checkoutUrl,
    });
  },
);

// POST /payments/webhook — Handle payment provider notifications
paymentsRouter.post(
  '/webhook',
  dbGuard(),
  zValidator('json', WebhookBodySchema, validationHook),
  async (c) => {
    const db = c.var.db;
    const providers = c.var.paymentProviders;

    const payload = c.req.valid('json');
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const dataId = c.req.query('data.id');

    if (!dataId) {
      return problem(c, ERRORS.MISSING_DATA_ID);
    }

    // Determine provider from payload or headers
    const providerName = detectProviderFromPayload(payload, headers);
    if (!providerName) {
      return problem(c, ERRORS.UNKNOWN_PROVIDER);
    }
    const provider = providers[providerName];

    if (!provider) {
      return problem(c, ERRORS.UNKNOWN_PROVIDER);
    }

    // Process webhook
    const result = await provider.processWebhook(payload, headers, dataId);

    if (!result.externalReference) {
      logger.error('[WEBHOOK] Missing external_reference in webhook result', {
        providerPaymentId: result.providerPaymentId,
        event: result.event,
      });
      return problem(c, ERRORS.MISSING_REFERENCE);
    }

    // Map webhook event to purchase status
    const newStatus = mapWebhookEventToStatus(result.event);

    // Look up our purchase by UUID (external_reference is our purchase ID set at checkout)
    const [existing] = await db
      .select({ status: purchases.status, metadata: purchases.metadata })
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
        return success(c, { status: 'ok' });
      }

      if (!VALID_WEBHOOK_TRANSITIONS[existing.status]?.includes(newStatus)) {
        // Invalid transition — possible replay attack
        logger.warn(
          '[METRIC:invalid_webhook_transition_total] Invalid webhook transition rejected',
          {
            purchaseId: result.externalReference,
            providerPaymentId: result.providerPaymentId,
            from: existing.status,
            attempted: newStatus,
            'x-request-id': headers['x-request-id'] || 'unknown',
            reason: `${existing.status} → ${newStatus} is not a valid MP transition`,
          },
        );
        return success(c, { status: 'ok' });
      }
    }

    // Preserve existing metadata (e.g. redirectUrl set during checkout creation)
    const existingMeta = (existing?.metadata as Record<string, unknown>) || {};
    const incomingMeta = (result.metadata as Record<string, unknown>) || {};
    const mergedMetadata = { ...existingMeta, ...incomingMeta };

    logger.info('[WEBHOOK] Updating purchase status & preserving metadata', {
      purchaseId: result.externalReference,
      newStatus,
      existingMeta,
      incomingMeta,
      mergedMetadata,
    });

    // Update purchase by our UUID, storing the real MP payment ID
    const [purchase] = await db
      .update(purchases)
      .set({
        status: newStatus,
        providerPaymentId: result.providerPaymentId,
        email: result.email || undefined,
        metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, result.externalReference))
      .returning();

    if (!purchase) {
      return problem(c, ERRORS.PURCHASE_NOT_FOUND);
    }

    return success(c, { status: 'ok' });
  },
);

// GET /payments/return/:status/:purchaseId — Redirect browser back to app after MP checkout
// These endpoints receive the user after MP payment and send them back to the app's deep link.
paymentsRouter.get(
  '/return/:status/:purchaseId',
  dbGuard(),
  zValidator('param', ReturnParamSchema, validationHook),
  async (c) => {
    const { status, purchaseId } = c.req.valid('param');
    const db = c.var.db;

    // Look up redirectUrl stored in purchase metadata
    try {
      const [purchase] = await db
        .select({ metadata: purchases.metadata })
        .from(purchases)
        .where(eq(purchases.id, purchaseId))
        .limit(1);

      logger.info('[PAYMENTS] Return endpoint loaded purchase metadata', {
        purchaseId,
        status,
        foundPurchase: !!purchase,
        metadata: purchase?.metadata,
      });

      if (purchase?.metadata) {
        const meta = purchase.metadata as { redirectUrl?: string };
        if (meta.redirectUrl) {
          let targetUrl = meta.redirectUrl;
          const appScheme = c.var.appScheme;

          // If redirectUrl is HTTP/HTTPS, check if it's the native API callback or a web app origin
          if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
            if (targetUrl.includes(PAYMENT_ROUTES.CALLBACK)) {
              targetUrl = PAYMENT_ROUTES.nativeRedirect(status, purchaseId, appScheme);
            } else {
              try {
                const parsedUrl = new URL(targetUrl);
                targetUrl = `${parsedUrl.origin}${PAYMENT_ROUTES.PREFIX}/${status}/${purchaseId}`;
              } catch (error) {
                logger.warn('[PAYMENTS] Failed to parse targetUrl in return endpoint', {
                  targetUrl,
                  error,
                });
                targetUrl = '';
              }
            }
          } else if (targetUrl.includes('://')) {
            // Custom scheme native redirect
            targetUrl = PAYMENT_ROUTES.nativeRedirect(status, purchaseId, appScheme);
          }

          if (targetUrl) {
            logger.info('[PAYMENTS] Return endpoint redirecting', {
              purchaseId,
              status,
              rawRedirectUrl: meta.redirectUrl,
              finalTargetUrl: targetUrl,
            });

            return c.redirect(targetUrl, HTTP.FOUND);
          }
        }
      }
    } catch (error) {
      logger.warn('[PAYMENTS] Failed to read purchase metadata for return redirect', {
        purchaseId,
        error,
      });
    }

    // Fallback: redirect to referer origin or root (excluding payment gateway domains to prevent redirect loops)
    const referer = c.req.header('Referer');
    if (referer) {
      try {
        const url = new URL(referer);
        const host = url.hostname.toLowerCase();
        const isGatewayDomain = host.includes('mercadopago') || host.includes('mercadolibre');

        if (!isGatewayDomain) {
          logger.info('[PAYMENTS] Return endpoint falling back to referer origin', {
            purchaseId,
            status,
            refererOrigin: url.origin,
          });
          return c.redirect(url.origin, HTTP.FOUND);
        }
      } catch (error) {
        logger.warn('[PAYMENTS] Failed to parse Referer header in return endpoint', {
          referer,
          error,
        });
      }
    }

    // Default fallback: redirect to mobile app callback URL
    let baseUrl: string;
    try {
      baseUrl = new URL(c.req.url).origin;
    } catch (error) {
      logger.warn('[PAYMENTS] Failed to parse request URL origin for return fallback', { error });
      baseUrl = '';
    }

    const defaultFallbackUrl = `${baseUrl}${PAYMENT_ROUTES.CALLBACK}`;
    logger.info('[PAYMENTS] Return endpoint falling back to default callback URL', {
      purchaseId,
      status,
      defaultFallbackUrl,
    });

    return c.redirect(defaultFallbackUrl, HTTP.FOUND);
  },
);

// GET /payments/callback — Native deep link redirect fallback
paymentsRouter.get('/callback', (c) => {
  const appScheme = c.var.appScheme;
  return c.redirect(PAYMENT_ROUTES.nativeCallback(appScheme), HTTP.FOUND);
});

// GET /payments/status/:purchaseId — Check purchase status (with optional active fallback polling)
paymentsRouter.get(
  '/status/:purchaseId',
  dbGuard(),
  zValidator('param', PurchaseIdParamSchema, validationHook),
  async (c) => {
    const db = c.var.db;
    const { purchaseId } = c.req.valid('param');
    const shouldSync = c.req.query('sync') === 'true';

    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      return problem(c, ERRORS.PURCHASE_NOT_FOUND);
    }

    // Active status synchronization fallback (triggered optionally via ?sync=true)
    if (
      shouldSync &&
      purchase.status === 'pending' &&
      purchase.providerPaymentId &&
      !purchase.providerPaymentId.startsWith('pending-')
    ) {
      try {
        const providers = c.var.paymentProviders;
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
        logger.error('Active payment status fallback check failed:', error);
      }
    }

    return success(c, {
      purchaseId: purchase.id,
      status: purchase.status,
      experienceId: purchase.experienceId,
      provider: purchase.provider,
      amount: purchase.amount,
      currency: purchase.currency,
      email: purchase.email,
    });
  },
);

// GET /experiences/:id/purchased?email= — Check if email purchased an experience
paymentsRouter.get(
  '/experiences/:id/purchased',
  dbGuard(),
  zValidator('param', IdParamSchema, validationHook),
  zValidator('query', EmailQuerySchema, validationHook),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const { email } = c.req.valid('query') as { email: string };

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
      return success(c, { purchased: false });
    }

    return success(c, {
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
  },
);

// GET /payments/purchases?email= — List all purchases for an email
paymentsRouter.get(
  '/purchases',
  dbGuard(),
  zValidator('query', EmailQuerySchema, validationHook),
  async (c) => {
    const db = c.var.db;
    const { email } = c.req.valid('query') as { email: string };

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

    return success(c, { purchases: list });
  },
);

/**
 * Detect which payment provider a webhook payload belongs to.
 * MP webhooks have { type: "payment", data: { id: "..." } }.
 * Future providers can be detected by different payload structures or headers.
 */
function detectProviderFromPayload(
  payload: unknown,
  _headers: Record<string, string>,
): string | null {
  const body = payload as { type?: string };
  if (body.type === 'payment') {
    return 'mercadopago';
  }
  // Future: detect Stripe (stripe-signature header), PayPal (event_type field)
  return null;
}

// POST /experiences/:id/access — Log experience access (fire-and-forget from mobile)
paymentsRouter.post(
  '/experiences/:id/access',
  dbGuard(),
  deviceIdGuard(),
  zValidator('param', IdParamSchema, validationHook),
  zValidator('json', LogAccessBodySchema, validationHook),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json') as {
      source: 'free' | 'paid' | 'restored';
      email?: string | null;
      platform?: 'ios' | 'android' | 'web' | null;
    };

    const deviceId = c.var.deviceId;

    // Get current price for snapshot
    const [experience] = await db
      .select({ price: experiences.price })
      .from(experiences)
      .where(eq(experiences.id, id))
      .limit(1);

    await db.insert(experienceAccesses).values({
      experienceId: id,
      email: body.email ?? null,
      deviceId,
      source: body.source,
      priceAtAccess: experience?.price ?? null,
      platform: body.platform ?? null,
    });

    return created(c, { status: 'ok' });
  },
);

export { paymentsRouter };
