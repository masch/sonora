import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { translations } from '../db/schema';
import { type Env, type Variables } from '../index';
import { TranslationBulkPayloadSchema } from '@sonora/shared';

const translationsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/translations/:lang — public, returns { key: value } flat JSON
translationsRouter.get('/:lang', async (c) => {
  const lang = c.req.param('lang');

  // Validate lang is 2-letter ISO 639-1
  if (!/^[a-z]{2}$/.test(lang)) {
    return c.json({ error: 'Invalid language code. Must be a 2-letter ISO 639-1 code.' }, 400);
  }

  const db = c.var.db;
  if (!db) {
    return c.json({ error: 'Database connection not available' }, 500);
  }

  try {
    const rows = await db
      .select({ key: translations.key, value: translations.value })
      .from(translations)
      .where(eq(translations.lang, lang));

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }

    return c.json(result, 200);
  } catch (err) {
    console.error('Failed to fetch translations:', err);
    return c.json({ error: 'Failed to fetch translations' }, 500);
  }
});

// PUT /api/translations — admin, Bearer auth, bulk upsert
translationsRouter.put('/', async (c) => {
  // Admin auth check (same pattern as audio.ts)
  const authHeader = c.req.header('Authorization');
  const adminKey =
    c.env?.ADMIN_API_KEY ||
    (typeof process !== 'undefined' ? process.env.ADMIN_API_KEY : undefined);

  if (!adminKey) {
    console.error('ADMIN_API_KEY variable de entorno no configurada.');
    return c.json({ error: 'Server misconfiguration: ADMIN_API_KEY is missing' }, 500);
  }

  if (authHeader !== `Bearer ${adminKey}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Parse and validate body
  const body: unknown = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Request body is required' }, 400);
  }

  const result = TranslationBulkPayloadSchema.safeParse(body);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return c.json({ error: 'Validation failed', details }, 422);
  }

  const db = c.var.db;
  if (!db) {
    return c.json({ error: 'Database connection not available' }, 500);
  }

  try {
    let updated = 0;
    for (const entry of result.data) {
      await db
        .insert(translations)
        .values({
          lang: entry.lang,
          key: entry.key,
          value: entry.value,
        })
        .onConflictDoUpdate({
          target: [translations.lang, translations.key],
          set: { value: entry.value, updatedAt: new Date() },
        });
      updated++;
    }

    return c.json({ updated }, 200);
  } catch (err) {
    console.error('Failed to upsert translations:', err);
    return c.json({ error: 'Failed to save translations' }, 500);
  }
});

export { translationsRouter };
