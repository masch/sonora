import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { feedback } from '../db/schema';
import { isUniqueViolation } from '../utils/db-errors';
import { type Env, type Variables } from '../index';

import {
  FeedbackPostBodySchema,
  type FeedbackPostBody,
  type FeedbackResponse,
} from '@sonora/shared';
import { validationHook } from '../middleware/validation-error';
import { ERRORS, problem, created, success } from '../middleware/problem-details';
import { dbGuard } from '../middleware/db-guard';

const feedbackRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

feedbackRouter.post('/', zValidator('json', FeedbackPostBodySchema, validationHook), async (c) => {
  const { message, idempotencyKey, createdAt, latitude, longitude } = c.req.valid(
    'json',
  ) as FeedbackPostBody;

  const env = c.env || {};
  if (env.FEEDBACK_STORE) {
    const existing = await env.FEEDBACK_STORE.get(idempotencyKey);
    if (existing) {
      return problem(c, ERRORS.DUPLICATE_REQUEST);
    }

    await env.FEEDBACK_STORE.put(
      idempotencyKey,
      JSON.stringify({ message, idempotencyKey, createdAt, latitude, longitude }),
      {
        expirationTtl: 30 * 24 * 60 * 60, // 30 days
      },
    );
  }

  const db = c.var.db;
  if (db) {
    try {
      await db.insert(feedback).values({
        experienceId: (c.req.valid('json') as FeedbackPostBody).experienceId,
        message,
        idempotencyKey,
        createdAt: new Date(createdAt),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return problem(c, ERRORS.DUPLICATE_REQUEST);
      }
      throw err;
    }
  }

  return created(c, { status: 'ok' } as FeedbackResponse);
});

feedbackRouter.get('/', dbGuard(), async (c) => {
  const db = c.var.db;
  const results = await db.select().from(feedback);
  const entries = results.map((row) => ({
    id: row.idempotencyKey,
    experienceId: row.experienceId,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
  }));
  return success(c, entries);
});

export { feedbackRouter };
export type { FeedbackResponse };
