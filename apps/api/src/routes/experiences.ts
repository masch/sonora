import { and, eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { zValidator } from '@hono/zod-validator';
import {
  DEFAULT_REMOTE_CONFIG,
  ProximityBodySchema,
  type ProximityBody,
  resolveProximity,
  type UserExperienceFormat,
} from '@sonora/shared';
import { experienceAccesses, experiences, purchases, waypoints } from '../db/schema';
import { type Env, type Variables } from '../index';
import { dbGuard } from '../middleware/db-guard';
import { deviceIdGuard } from '../middleware/device-id-guard';
import { ERRORS, problem, success } from '../middleware/problem-details';
import { urlGuard } from '../middleware/url-guard';
import { validationHook } from '../middleware/validation-error';

import { jwtGuard } from '../middleware/jwt-guard';
import { RATE_LIMIT_DEFAULTS, rateLimit } from '../middleware/rate-limit-guard';

const experiencesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

experiencesRouter.get(
  '/',
  dbGuard(),
  urlGuard(),
  deviceIdGuard(),
  jwtGuard(),
  rateLimit(RATE_LIMIT_DEFAULTS.EXPERIENCES_LIST),
  async (c) => {
    const db = c.var.db;
    const list = await db.select().from(experiences).where(eq(experiences.published, true));
    const result = [];
    const baseUrl = c.var.requestUrl.origin;
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

experiencesRouter.post(
  '/:id/proximity',
  dbGuard(),
  deviceIdGuard(),
  rateLimit(RATE_LIMIT_DEFAULTS.PROXIMITY_CHECK),
  zValidator('json', ProximityBodySchema, validationHook),
  async (c) => {
    const db = c.var.db;
    const id = c.req.param('id');
    const exp = await db.query.experiences.findFirst({
      where: (experiences, { and, eq }) =>
        and(eq(experiences.id, id), eq(experiences.published, true)),
      columns: {
        format: true,
        latitude: true,
        longitude: true,
        geoMode: true,
        radiusMeters: true,
      },
    });
    if (!exp) {
      return problem(c, ERRORS.NOT_FOUND, 'Experience not found');
    }
    const { latitude, longitude } = c.req.valid('json') as ProximityBody;

    const geo = resolveProximity({
      user: { latitude, longitude },
      origin: { latitude: exp.latitude, longitude: exp.longitude },
      format: exp.format as UserExperienceFormat,
      geoMode: exp.geoMode,
      radiusMeters: exp.radiusMeters,
      bypassGeofence: DEFAULT_REMOTE_CONFIG.geofence.bypassGeofence,
      geofence: DEFAULT_REMOTE_CONFIG.geofence,
    });

    return success(c, {
      canListen: geo.canListen,
      distanceMeters: geo.distanceMeters,
      effectiveRadiusMeters: geo.effectiveRadiusMeters,
    });
  },
);

export { experiencesRouter };
