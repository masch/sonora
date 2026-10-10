import { Hono } from 'hono';
import { leads } from '../db/schema';
import { type Env, type Variables } from '../index';
import { LeadPostBodySchema, type LeadPostBody, type LeadResponse } from '@sonora/shared';
import { validateJson } from '../middleware/validation-error';
import { created } from '../middleware/problem-details';
import { dbGuard } from '../middleware/db-guard';
import { envGuard } from '../middleware/env-guard';
import { rateLimitMutation } from '../middleware/rate-limit-guard';

const leadsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

leadsRouter.use('*', envGuard());
leadsRouter.use('*', dbGuard());

leadsRouter.post(
  '/',
  rateLimitMutation('leads:submit'),
  validateJson(LeadPostBodySchema),
  async (c) => {
    const { email, experienceId, source } = c.req.valid('json') as LeadPostBody;
    const normalizedEmail = email.toLowerCase().trim();

    const db = c.var.db;
    await db.insert(leads).values({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      experienceId: experienceId ?? null,
      source,
      createdAt: new Date(),
    });

    const response: LeadResponse = { status: 'ok' };
    return created(c, response);
  },
);

export { leadsRouter };
