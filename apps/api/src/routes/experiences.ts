import { Hono } from 'hono';
import { experiences, waypoints } from '../db/schema';
import { type Env, type Variables } from '../index';
import { eq } from 'drizzle-orm';
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
    const jwtSecret = c.env.JWT_SECRET || 'sonora-jwt-secret-key-1234';
    const expirySeconds = parseInt(c.env.AUDIO_LINK_EXPIRY_SECONDS || '900', 10);

    for (const exp of list) {
      const expWaypoints = await db
        .select()
        .from(waypoints)
        .where(eq(waypoints.experienceId, exp.id))
        .orderBy(waypoints.order);

      let mappedAudioUrl = null;
      if (exp.audioUrl) {
        if (exp.audioUrl.startsWith('http')) {
          mappedAudioUrl = exp.audioUrl;
        } else {
          const payload = {
            key: exp.audioUrl,
            exp: Math.floor(Date.now() / 1000) + expirySeconds,
          };
          const token = await sign(payload, jwtSecret);
          mappedAudioUrl = `${baseUrl}/audio/stream?key=${encodeURIComponent(exp.audioUrl)}&token=${token}`;
        }
      }

      const mappedWaypoints = await Promise.all(
        expWaypoints.map(async (wp) => {
          let mappedWpAudioUrl = null;
          if (wp.audioUrl) {
            if (wp.audioUrl.startsWith('http')) {
              mappedWpAudioUrl = wp.audioUrl;
            } else {
              const payload = {
                key: wp.audioUrl,
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
