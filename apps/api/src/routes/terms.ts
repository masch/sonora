import { AcceptTermsRequestSchema, TermsQuerySchema, type TermsResponse } from '@sonora/shared';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { termsAcceptances, termsVersions } from '../db/schema';
import type { Env, Variables } from '../index';
import { dbGuard } from '../middleware/db-guard';
import { envGuard } from '../middleware/env-guard';
import { created, ERRORS, problem, success } from '../middleware/problem-details';
import { validateJson, validateQuery } from '../middleware/validation-error';
import { getClientMetadata } from '../utils/client-metadata';

const termsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

termsRouter.use('*', envGuard());

// GET /terms?lang=en|es — returns latest active terms for requested language
termsRouter.get('/', validateQuery(TermsQuerySchema), dbGuard(), async (c) => {
  const { lang } = c.req.valid('query');
  const db = c.var.db;

  const rows = await db
    .select()
    .from(termsVersions)
    .where(eq(termsVersions.lang, lang))
    .orderBy(desc(termsVersions.publishedAt))
    .limit(1);

  if (!rows.length) {
    return problem(c, ERRORS.NOT_FOUND);
  }

  const active = rows[0];
  const response: TermsResponse = {
    version: active.version,
    lang: active.lang,
    title: active.title,
    content: active.content,
    contentHash: active.contentHash,
    publishedAt: active.publishedAt.toISOString(),
  };

  return success(c, response);
});

// POST /terms/accept — records legal consent audit trail
termsRouter.post('/accept', validateJson(AcceptTermsRequestSchema), dbGuard(), async (c) => {
  const { deviceId, version, lang, contentHash, platform } = c.req.valid('json');
  const db = c.var.db;

  const rows = await db
    .select()
    .from(termsVersions)
    .where(eq(termsVersions.lang, lang))
    .orderBy(desc(termsVersions.publishedAt))
    .limit(1);

  if (!rows.length) {
    return problem(c, ERRORS.NO_ACTIVE_TERMS);
  }

  const active = rows[0];
  if (active.version !== version || active.contentHash !== contentHash) {
    return problem(c, ERRORS.TERMS_VERSION_MISMATCH);
  }

  const { ipAddress, userAgent } = getClientMetadata(c);

  await db.insert(termsAcceptances).values({
    deviceId,
    version,
    lang,
    contentHash,
    platform,
    ipAddress,
    userAgent,
    acceptedAt: new Date(),
  });

  return created(c, { success: true });
});

export { termsRouter };
