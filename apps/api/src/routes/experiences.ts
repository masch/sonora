import { Hono } from 'hono';
import { experiences, waypoints, experienceAccesses, purchases } from '../db/schema';
import { type Env, type Variables } from '../index';
import { eq, and, or } from 'drizzle-orm';
import { sign } from 'hono/jwt';

const experiencesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

experiencesRouter.get('/', async (c) => {
  const db = c.var.db;
  if (!db) {
    return c.json({ error: 'Database client not available' }, 500);
  }
  try {
    const list = await db.select().from(experiences);
    const result = [];
    const baseUrl = new URL(c.req.url).origin;
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.json({ error: 'Server configuration error: JWT secret not configured' }, 500);
    }
    const expirySeconds = parseInt(c.env.AUDIO_LINK_EXPIRY_SECONDS || '900', 10);

    const deviceId = c.var.deviceId;
    if (!deviceId) {
      return c.json({ error: 'Device ID is required' }, 400);
    }

    const accesses = await db
      .select({ experienceId: experienceAccesses.experienceId })
      .from(experienceAccesses)
      .where(eq(experienceAccesses.deviceId, deviceId));

    const email = c.req.query('email');
    const purchaseConditions = [eq(purchases.status, 'approved')];
    if (email) {
      purchaseConditions.push(or(eq(purchases.deviceId, deviceId), eq(purchases.email, email))!);
    } else {
      purchaseConditions.push(eq(purchases.deviceId, deviceId));
    }

    const approvedPurchases = await db
      .select({ experienceId: purchases.experienceId })
      .from(purchases)
      .where(and(...purchaseConditions)!);

    const allowedExperienceIds = new Set([
      ...accesses.map((a) => a.experienceId),
      ...approvedPurchases.map((p) => p.experienceId),
    ]);

    for (const exp of list) {
      const expWaypoints = await db
        .select()
        .from(waypoints)
        .where(eq(waypoints.experienceId, exp.id))
        .orderBy(waypoints.order);

      const hasAccess = exp.free || allowedExperienceIds.has(exp.id);

      let mappedAudioUrl = null;
      if (exp.audioUrl && hasAccess) {
        if (exp.audioUrl.startsWith('http')) {
          mappedAudioUrl = exp.audioUrl;
        } else {
          const payload = {
            key: exp.audioUrl,
            deviceId,
            exp: Math.floor(Date.now() / 1000) + expirySeconds,
          };
          const token = await sign(payload, jwtSecret);
          mappedAudioUrl = `${baseUrl}/audio/stream?key=${encodeURIComponent(exp.audioUrl)}&token=${token}`;
        }
      }

      const mappedWaypoints = await Promise.all(
        expWaypoints.map(async (wp) => {
          let mappedWpAudioUrl = null;
          if (wp.audioUrl && hasAccess) {
            if (wp.audioUrl.startsWith('http')) {
              mappedWpAudioUrl = wp.audioUrl;
            } else {
              const payload = {
                key: wp.audioUrl,
                deviceId,
                exp: Math.floor(Date.now() / 1000) + expirySeconds,
              };
              const token = await sign(payload, jwtSecret);
              mappedWpAudioUrl = `${baseUrl}/audio/stream?key=${encodeURIComponent(wp.audioUrl)}&token=${token}`;
            }
          }
          return {
            ...wp,
            audioUrl: mappedWpAudioUrl,
          };
        }),
      );

      result.push({
        ...exp,
        audioUrl: mappedAudioUrl,
        waypoints: mappedWaypoints,
      });
    }
    return c.json(result);
  } catch (err) {
    console.error('Failed to fetch experiences:', err);
    return c.json({ error: 'Failed to fetch experiences' }, 500);
  }
});

export { experiencesRouter };
