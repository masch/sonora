import { zValidator } from '@hono/zod-validator';
import type { SupportedLanguage } from '@sonora/shared';
import { TranslationBulkPayloadSchema, z } from '@sonora/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { translations } from '../db/schema';
import type { Env, Variables } from '../index';
import { adminAuthGuard, timingSafeCompare } from '../middleware/admin-auth-guard';
import { dbGuard } from '../middleware/db-guard';
import { ERRORS, problem, success } from '../middleware/problem-details';
import { validationHook } from '../middleware/validation-error';

const LangParamSchema = z.object({
  lang: z.string().regex(/^[a-z]{2}$/),
});

const translationsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/translations/session — admin auth, checks if the session cookie is valid
translationsRouter.get('/session', adminAuthGuard(), async (c) => {
  return success(c, { valid: true });
});

// POST /api/translations/session — validates key and sets HttpOnly admin_session cookie
translationsRouter.post('/session', async (c) => {
  const adminKey = c.env?.ADMIN_API_KEY;
  if (!adminKey) {
    return problem(c, ERRORS.MISCONFIG);
  }

  const body = await c.req.json<{ key?: string }>().catch(() => ({ key: undefined }));
  if (!body.key || !(await timingSafeCompare(body.key, adminKey))) {
    return problem(c, ERRORS.UNAUTHORIZED);
  }

  const sameSite = c.env?.ADMIN_SESSION_COOKIE_SAMESITE || 'Strict';
  const secure = c.env?.ADMIN_SESSION_COOKIE_SECURE !== 'false';

  setCookie(c, 'admin_session', adminKey, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api',
    maxAge: 28800,
  });

  return success(c, { valid: true });
});

// DELETE /api/translations/session — clears admin_session cookie
translationsRouter.delete('/session', async (c) => {
  deleteCookie(c, 'admin_session', { path: '/api' });
  return success(c, { cleared: true });
});

// GET /api/translations/:lang — public, returns { key: value } flat JSON
translationsRouter.get(
  '/:lang',
  zValidator('param', LangParamSchema, validationHook),
  async (c) => {
    const lang = c.req.param('lang');

    const db = c.var.db;
    if (!db) {
      return problem(c, ERRORS.DB_NOT_AVAILABLE);
    }

    const rows = await db
      .select({ key: translations.key, value: translations.value })
      .from(translations)
      .where(eq(translations.lang, lang as SupportedLanguage));

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }

    return success(c, result);
  },
);

// PUT /api/translations — admin auth, bulk upsert
translationsRouter.put(
  '/',
  adminAuthGuard(),
  zValidator('json', TranslationBulkPayloadSchema, validationHook),
  dbGuard(),
  async (c) => {
    const entries = c.req.valid('json');

    const db = c.var.db;
    let updated = 0;
    for (const entry of entries) {
      if (entry.value === '') {
        // Delete override to restore default code translation
        await db
          .delete(translations)
          .where(
            and(
              eq(translations.lang, entry.lang as SupportedLanguage),
              eq(translations.key, entry.key),
            ),
          );
      } else {
        // Upsert the override
        await db
          .insert(translations)
          .values({
            lang: entry.lang as SupportedLanguage,
            key: entry.key,
            value: entry.value,
          })
          .onConflictDoUpdate({
            target: [translations.lang, translations.key],
            set: { value: entry.value, updatedAt: new Date() },
          });
      }
      updated++;
    }

    return success(c, { updated });
  },
);

export { translationsRouter };
