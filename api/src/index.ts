import { Hono } from 'hono';
import { createDbClient, type DbClient } from './db';
import { feedback } from './db/schema';

export interface Env {
  FEEDBACK_STORE?: KVNamespace;
  FEEDBACK_MAX_LENGTH?: string;
  DATABASE_URL?: string;
  DB_ADAPTER?: 'neon';
}

export interface Variables {
  db?: DbClient;
}

let _dbClient: DbClient | null = null;

export function setDbClient(db: DbClient | null): void {
  _dbClient = db;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware: inject DB client into request context
app.use('*', async (c, next) => {
  if (_dbClient) {
    c.set('db', _dbClient);
  } else if (c.env?.DATABASE_URL) {
    _dbClient = createDbClient((c.env.DB_ADAPTER as 'neon') || 'neon', c.env.DATABASE_URL);
    c.set('db', _dbClient);
  }
  await next();
});

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

interface PostgresError {
  code?: string;
  cause?: { code?: string };
}

export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const pgErr = err as PostgresError;
  return pgErr.code === '23505' || pgErr.cause?.code === '23505';
}

app.post('/feedback', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const validation = validateBody(body);

  if (!validation.valid) {
    return c.json<FeedbackResponse>({ status: 'error', errors: validation.errors }, 422);
  }

  const { message, idempotencyKey, createdAt } = validation.data;

  // Check max length (c.env may be undefined outside CF Workers e.g. in tests)
  const env = c.env || {};
  const maxLength = parseInt(env.FEEDBACK_MAX_LENGTH || '1000', 10);
  if (message.length > maxLength) {
    return c.json<FeedbackResponse>(
      { status: 'error', errors: [`message must not exceed ${maxLength} characters`] },
      422,
    );
  }

  // Dedup check via KV store (fast-path)
  if (env.FEEDBACK_STORE) {
    const existing = await env.FEEDBACK_STORE.get(idempotencyKey);
    if (existing) {
      return c.json<FeedbackResponse>({ status: 'duplicate' }, 409);
    }

    // Store idempotency key with 30-day TTL
    await env.FEEDBACK_STORE.put(idempotencyKey, JSON.stringify(validation.data), {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days
    });
  }

  // DB insert via Drizzle (authoritative dedup via UNIQUE constraint)
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

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json<FeedbackResponse>({ status: 'error', errors: ['Internal server error'] }, 500);
});

export default app;
