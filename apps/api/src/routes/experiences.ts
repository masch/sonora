import { Hono } from 'hono';
import { experiences, waypoints, experienceAccesses, purchases } from '../db/schema';
import { type Env, type Variables } from '../index';
import { eq, and, or } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { success } from '../middleware/problem-details';
import { dbGuard } from '../middleware/db-guard';
import { deviceIdGuard } from '../middleware/device-id-guard';

import { jwtGuard } from '../middleware/jwt-guard';
import { rateLimit, RATE_LIMIT_DEFAULTS } from '../middleware/rate-limit-guard';

const experiencesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

experiencesRouter.get(
  '/',
  dbGuard(),
  deviceIdGuard(),
  jwtGuard(),
  rateLimit(RATE_LIMIT_DEFAULTS.EXPERIENCES_LIST),
  async (c) => {
    const db = c.var.db;
    const list = await db.select().from(experiences);
    const result = [];
    const baseUrl = new URL(c.req.url).origin;
    const jwtSecret = c.var.jwtSecret;
    const expirySeconds = c.var.audioLinkExpirySeconds;

    const deviceId = c.var.deviceId;

    const accesses = await db
      .select({ experienceId: experienceAccesses.experienceId })
      .from(experienceAccesses)
      .where(eq(experienceAccesses.deviceId, deviceId));

    const email = c.req.query('email');
    const purchaseConditions = [eq(purchases.status, 'approved')];

    const deviceOrEmailFilter = email
      ? or(eq(purchases.deviceId, deviceId), eq(purchases.email, email))
      : eq(purchases.deviceId, deviceId);

    if (deviceOrEmailFilter) {
      purchaseConditions.push(deviceOrEmailFilter);
    }

    const approvedPurchases = await db
      .select({ experienceId: purchases.experienceId })
      .from(purchases)
      .where(and(...purchaseConditions));

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
    return success(c, result);
  },
);

export { experiencesRouter };
