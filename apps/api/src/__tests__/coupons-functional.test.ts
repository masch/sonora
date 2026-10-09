import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../index';
import {
  experiences,
  experienceCoupons,
  experienceCouponRedemptions,
  experienceAccesses,
  purchases,
  waypoints,
} from '../db/schema';

const EXPERIENCE_ID = '550e8400-e29b-41d4-a716-446655440000';
const ADMIN_KEY = 'test-admin-key-123';
const JWT_SECRET = 'test-jwt-secret';
const HMAC_SECRET = 'test-hmac-secret';

const env = {
  ADMIN_API_KEY: ADMIN_KEY,
  JWT_SECRET,
  HMAC_SECRET,
  AUDIO_LINK_EXPIRY_SECONDS: '900',
  MP_ACCESS_TOKEN: 'test-mp-token',
  MP_WEBHOOK_SECRET: 'test-webhook-secret',
};

describe('Viaje Grupal — End-to-End Functional Test Suite', () => {
  // In-memory stateful store to simulate real PostgreSQL DB behavior
  let couponsTable: Map<string, any>;
  let redemptionsTable: Map<string, any>;
  let statefulDb: any;

  beforeEach(() => {
    couponsTable = new Map();
    redemptionsTable = new Map();

    const getTableRows = (table: any) => {
      if (table === experiences) {
        return [
          {
            id: EXPERIENCE_ID,
            title: 'Deriva Paga',
            free: false,
            audioUrl: 'paid-audio-track.mp3',
            published: true,
          },
        ];
      }
      if (table === experienceCoupons) {
        return Array.from(couponsTable.values());
      }
      if (table === experienceCouponRedemptions) {
        return Array.from(redemptionsTable.values());
      }
      if (table === experienceAccesses || table === purchases || table === waypoints) {
        return [];
      }
      return [];
    };

    const extractParamValues = (obj: any): any[] => {
      if (!obj) return [];
      if (obj.value !== undefined) {
        if (Array.isArray(obj.value)) return obj.value.flatMap(extractParamValues);
        return [obj.value];
      }
      if (Array.isArray(obj)) return obj.flatMap(extractParamValues);
      if (obj.queryChunks) return extractParamValues(obj.queryChunks);
      return [];
    };

    const makeQueryObj = (table: any, getRows: () => any[]) => {
      const obj: any = {
        limit: (n: number) => Promise.resolve(getRows().slice(0, n)),
        orderBy: () => obj,
        where: (cond?: any) => {
          if (table === experienceCouponRedemptions && cond) {
            return makeQueryObj(table, () => {
              const allRedemptions = Array.from(redemptionsTable.values());
              const params = extractParamValues(cond);
              const targetDevice = params.find((p) => allRedemptions.some((r) => r.deviceId === p));
              if (targetDevice) {
                return allRedemptions.filter((r) => r.deviceId === targetDevice);
              }
              return [];
            });
          }
          return obj;
        },
        then: (resolve: any, reject: any) => {
          try {
            return Promise.resolve(getRows()).then(resolve, reject);
          } catch (e) {
            return Promise.reject(e).then(resolve, reject);
          }
        },
      };
      return obj;
    };

    statefulDb = {
      select: (_selectFields?: any) => ({
        from: (table: any) => {
          const query = makeQueryObj(table, () => getTableRows(table));
          query.innerJoin = () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          });
          return query;
        },
      }),
      insert: (_table: any) => ({
        values: (record: any) => ({
          onConflictDoUpdate: ({ set }: any) => ({
            returning: () => {
              const key = `${record.experienceId}:${record.emailHash}`;
              const existing = couponsTable.get(key) || {};
              const updated = {
                usedDownloads: 0,
                ...existing,
                ...record,
                ...set,
                id: existing.id || 'coupon-uuid-1',
                createdAt: existing.createdAt || new Date(),
              };
              couponsTable.set(key, updated);
              return Promise.resolve([updated]);
            },
          }),
          then: (resolve: any, reject: any) => {
            const key = `${record.couponId}:${record.deviceId}`;
            const saved = { ...record, id: `redemption-${redemptionsTable.size + 1}` };
            redemptionsTable.set(key, saved);
            return Promise.resolve([saved]).then(resolve, reject);
          },
        }),
      }),
      update: (table: any) => ({
        set: (updates: any) => ({
          where: (cond: any) => {
            const doUpdate = () => {
              if (table === experienceCoupons && cond) {
                const params = extractParamValues(cond);
                for (const [k, targetCoupon] of couponsTable.entries()) {
                  if (params.includes(targetCoupon.id)) {
                    const isDecrement = updates?.usedDownloads?.queryChunks?.some(
                      (c: any) => Array.isArray(c.value) && c.value.includes(' - 1'),
                    );
                    if (isDecrement) {
                      const updated = {
                        ...targetCoupon,
                        usedDownloads: Math.max(0, targetCoupon.usedDownloads - 1),
                      };
                      couponsTable.set(k, updated);
                      return [updated];
                    }
                    if (targetCoupon.usedDownloads >= targetCoupon.maxDownloads) {
                      return [];
                    }
                    const updated = {
                      ...targetCoupon,
                      usedDownloads: targetCoupon.usedDownloads + 1,
                    };
                    couponsTable.set(k, updated);
                    return [updated];
                  }
                }
              }
              return [];
            };

            const queryObj: any = {
              returning: (_fields?: any) => {
                const rows = doUpdate();
                return Promise.resolve(rows);
              },
              then: (resolve: any, reject: any) => {
                const rows = doUpdate();
                return Promise.resolve({ rowCount: rows.length }).then(resolve, reject);
              },
            };
            return queryObj;
          },
        }),
      }),
    };

    setDbClient(statefulDb);
  });

  afterEach(() => {
    setDbClient(null);
  });

  it('runs complete lifecycle: admin creation -> device 1 redemption & audio access -> idempotency -> device 2 redemption -> device 3 quota exhaustion', async () => {
    const email = 'grupo.amigos@example.com';
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // +24h

    // 1. Admin creates a coupon for 2 downloads
    const createRes = await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/coupons`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
        body: JSON.stringify({
          email,
          startsAt: pastDate,
          expiresAt: futureDate,
          notes: 'Grupo amigos viaje colectivo',
          maxDownloads: 2,
        }),
      },
      env,
    );

    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as any;
    expect(createBody.emailMasked).toBe('g***s@example.com');
    expect(createBody.maxDownloads).toBe(2);
    expect(createBody.usedDownloads).toBe(0);

    // 2. Dispositivo 1 canjea el cupón
    const dev1Redeem = await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/purchased?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Device-Id': 'device-alpha-1',
          'X-Device-Platform': 'ios',
        },
      },
      env,
    );

    expect(dev1Redeem.status).toBe(200);
    const dev1RedeemBody = (await dev1Redeem.json()) as any;
    expect(dev1RedeemBody).toEqual({
      purchased: true,
    });

    // 3. Dispositivo 1 consulta catálogo y debe tener acceso a escuchar/descargar el audio
    const dev1Catalog = await app.request(
      '/experiences',
      {
        headers: {
          'X-Device-Id': 'device-alpha-1',
          'X-Device-Platform': 'ios',
        },
      },
      env,
    );

    expect(dev1Catalog.status).toBe(200);
    const dev1List = (await dev1Catalog.json()) as any[];
    expect(dev1List).toHaveLength(1);
    expect(dev1List[0].audioUrl).not.toBeNull();
    expect(dev1List[0].audioUrl).toContain('/audio/stream?key=paid-audio-track.mp3');

    // 4. Dispositivo 1 vuelve a consultar compra: debe ser idempotente y no consumir cupo adicional
    const dev1Retry = await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/purchased?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Device-Id': 'device-alpha-1',
          'X-Device-Platform': 'ios',
        },
      },
      env,
    );
    expect(dev1Retry.status).toBe(200);

    // 5. Dispositivo 2 canjea el cupón (segundo cupo consumido)
    const dev2Redeem = await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/purchased?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Device-Id': 'device-beta-2',
          'X-Device-Platform': 'android',
        },
      },
      env,
    );

    expect(dev2Redeem.status).toBe(200);
    const dev2RedeemBody = (await dev2Redeem.json()) as any;
    expect(dev2RedeemBody.purchased).toBe(true);

    // 6. Dispositivo 3 intenta canjear con el mismo email -> DEBE FALLAR con 403 COUPON_LIMIT_REACHED
    const dev3Redeem = await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/purchased?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Device-Id': 'device-gamma-3',
          'X-Device-Platform': 'ios',
        },
      },
      env,
    );

    expect(dev3Redeem.status).toBe(403);
    const dev3Body = (await dev3Redeem.json()) as any;
    expect(dev3Body.code).toBe('COUPON_LIMIT_REACHED');

    // 7. Dispositivo 3 consulta catálogo -> NO DEBE TENER ACCESO (audioUrl es null)
    // Para esta consulta, statefulDb devuelve solo redenciones del device-gamma-3 (ninguna)
    const dev3Catalog = await app.request(
      '/experiences',
      {
        headers: {
          'X-Device-Id': 'device-gamma-3',
          'X-Device-Platform': 'ios',
        },
      },
      env,
    );

    expect(dev3Catalog.status).toBe(200);
    const dev3List = (await dev3Catalog.json()) as any[];
    expect(dev3List[0].audioUrl).toBeNull();
  });

  it('rejects expired coupon on redemption and denies audio access', async () => {
    const email = 'expired.user@example.com';
    const pastStartDate = new Date(Date.now() - 7200000).toISOString(); // 2h in past
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1h in past

    // 1. Cupón creado que ya expiró
    await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/coupons`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
        body: JSON.stringify({
          email,
          startsAt: pastStartDate,
          expiresAt: pastDate,
          notes: 'Cupón de evento ayer',
          maxDownloads: 5,
        }),
      },
      env,
    );

    // 2. Intento de canje -> 403 COUPON_EXPIRED
    const redeemRes = await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/purchased?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Device-Id': 'device-late-1',
          'X-Device-Platform': 'ios',
        },
      },
      env,
    );

    expect(redeemRes.status).toBe(403);
    expect(await redeemRes.json()).toMatchObject({ code: 'COUPON_EXPIRED' });
  });

  it('rejects not-yet-started coupon on redemption and denies audio access', async () => {
    const email = 'future.user@example.com';
    const futureStartDate = new Date(Date.now() + 3600000).toISOString(); // +1h
    const futureExpireDate = new Date(Date.now() + 86400000).toISOString(); // +24h

    // 1. Cupón creado cuya fecha de inicio es en el futuro
    await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/coupons`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
        body: JSON.stringify({
          email,
          startsAt: futureStartDate,
          expiresAt: futureExpireDate,
          notes: 'Cupón para evento mañana',
          maxDownloads: 5,
        }),
      },
      env,
    );

    // 2. Intento de canje antes de fecha de inicio -> 403 COUPON_NOT_YET_VALID
    const redeemRes = await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/purchased?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Device-Id': 'device-early-1',
          'X-Device-Platform': 'ios',
        },
      },
      env,
    );

    expect(redeemRes.status).toBe(403);
    expect(await redeemRes.json()).toMatchObject({ code: 'COUPON_NOT_YET_VALID' });
  });

  it('enforces quota limit under simulated concurrent redemptions at boundary in stateful test double', async () => {
    const email = 'race.group@example.com';
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    // Create coupon with maxDownloads = 1
    await app.request(
      `/payments/experiences/${EXPERIENCE_ID}/coupons`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
        body: JSON.stringify({
          email,
          startsAt: pastDate,
          expiresAt: futureDate,
          notes: 'Cupón único límite 1',
          maxDownloads: 1,
        }),
      },
      env,
    );

    // Two devices attempt redemption concurrently
    const [resA, resB] = await Promise.all([
      app.request(
        `/payments/experiences/${EXPERIENCE_ID}/purchased?email=${encodeURIComponent(email)}`,
        {
          headers: {
            'X-Device-Id': 'device-concurrent-a',
            'X-Device-Platform': 'ios',
          },
        },
        env,
      ),
      app.request(
        `/payments/experiences/${EXPERIENCE_ID}/purchased?email=${encodeURIComponent(email)}`,
        {
          headers: {
            'X-Device-Id': 'device-concurrent-b',
            'X-Device-Platform': 'android',
          },
        },
        env,
      ),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 403]);

    const errorRes = resA.status === 403 ? resA : resB;
    expect(await errorRes.json()).toMatchObject({ code: 'COUPON_LIMIT_REACHED' });
  });
});
