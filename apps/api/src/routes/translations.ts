import { zValidator } from '@hono/zod-validator';
import type { SupportedLanguage } from '@sonora/shared';
import { TranslationBulkPayloadSchema, z } from '@sonora/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { translations } from '../db/schema';
import type { Env, Variables } from '../index';
import { dbGuard } from '../middleware/db-guard';
import { ERRORS, problem, success } from '../middleware/problem-details';
import { requireAdminKey } from '../middleware/require-admin-key';
import { validationHook } from '../middleware/validation-error';

const LangParamSchema = z.object({
  lang: z.string().regex(/^[a-z]{2}$/),
});

const translationsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

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

// POST /api/translations/validate — admin, Bearer auth, checks if the token is valid
translationsRouter.post('/validate', requireAdminKey(), async (c) => {
  return success(c, { valid: true });
});

// PUT /api/translations — admin, Bearer auth, bulk upsert
translationsRouter.put(
  '/',
  requireAdminKey(),
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
