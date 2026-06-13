import { Hono } from 'hono';
import { feedback } from '../db/schema';
import { isUniqueViolation } from '../utils/db-errors';
import { type Env, type Variables } from '../index';

interface FeedbackPostBody {
  tripId: string;
  message: string;
  idempotencyKey: string;
  createdAt: string;
}

interface FeedbackResponse {
  status: 'ok' | 'duplicate' | 'error';
  errors?: string[];
}

function validateBody(
  body: unknown,
): { valid: false; errors: string[] } | { valid: true; data: FeedbackPostBody } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.tripId !== 'string' || b.tripId.trim().length === 0) {
    errors.push('tripId is required and must be a non-empty string');
  }

  if (typeof b.message !== 'string' || b.message.trim().length === 0) {
    errors.push('message is required and must be a non-empty string');
  }

  if (typeof b.idempotencyKey !== 'string' || b.idempotencyKey.trim().length === 0) {
    errors.push('idempotencyKey is required and must be a non-empty string');
  }

  if (typeof b.createdAt !== 'string' || b.createdAt.trim().length === 0) {
    errors.push('createdAt is required and must be a non-empty string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: b as unknown as FeedbackPostBody,
  };
}

const feedbackRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

feedbackRouter.post('/', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const validation = validateBody(body);

  if (!validation.valid) {
    return c.json<FeedbackResponse>({ status: 'error', errors: validation.errors }, 422);
  }

  const { message, idempotencyKey, createdAt } = validation.data;

  const env = c.env || {};
  const maxLength = parseInt(env.FEEDBACK_MAX_LENGTH || '1000', 10);
  if (message.length > maxLength) {
    return c.json<FeedbackResponse>(
      { status: 'error', errors: [`message must not exceed ${maxLength} characters`] },
      422,
    );
  }

  if (env.FEEDBACK_STORE) {
    const existing = await env.FEEDBACK_STORE.get(idempotencyKey);
    if (existing) {
      return c.json<FeedbackResponse>({ status: 'duplicate' }, 409);
    }

    await env.FEEDBACK_STORE.put(idempotencyKey, JSON.stringify(validation.data), {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days
    });
  }

  const db = c.var.db;
  if (db) {
    try {
      await db.insert(feedback).values({
        tripId: validation.data.tripId,
        message: validation.data.message,
        idempotencyKey: validation.data.idempotencyKey,
        createdAt: new Date(createdAt),
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json<FeedbackResponse>({ status: 'duplicate' }, 409);
      }
      throw err;
    }
  }

  return c.json<FeedbackResponse>({ status: 'ok' }, 201);
});

export { feedbackRouter };
export type { FeedbackResponse };
