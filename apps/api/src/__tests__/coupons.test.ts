import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../index';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ADMIN_KEY = 'test-admin-key-123';
const env = {
  ADMIN_API_KEY: ADMIN_KEY,
  JWT_SECRET: 'test-jwt-secret',
  HMAC_SECRET: 'test-hmac-secret',
  MP_ACCESS_TOKEN: 'test-mp-token',
  MP_WEBHOOK_SECRET: 'test-webhook-secret',
};

describe('Experience Coupons (Viaje Grupal)', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setDbClient(null);
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    setDbClient(null);
  });

  describe('POST /payments/experiences/:id/coupons (Admin)', () => {
    it('returns 500 HMAC_SECRET_MISSING when HMAC_SECRET is missing', async () => {
      setDbClient(mockDb);
      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/coupons`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
          body: JSON.stringify({
            email: 'invited@example.com',
            expiresAt: '2026-12-31T23:59:59.000Z',
            notes: 'Prensa evento',
          }),
        },
        { ...env, HMAC_SECRET: undefined },
      );
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ code: 'HMAC_SECRET_MISSING' });
    });

    it('returns 401 when admin auth header is missing', async () => {
      setDbClient(mockDb);
      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/coupons`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'invited@example.com',
            expiresAt: '2026-12-31T23:59:59.000Z',
            notes: 'Prensa evento',
          }),
        },
        env,
      );
      expect(res.status).toBe(401);
    });

    it('returns 404 when experience is not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]); // experience not found
      setDbClient(mockDb);
      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/coupons`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
          body: JSON.stringify({
            email: 'invited@example.com',
            expiresAt: '2026-12-31T23:59:59.000Z',
            notes: 'Prensa evento',
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ code: 'EXPERIENCE_NOT_FOUND' });
    });

    it('returns 422 when required fields are missing', async () => {
      setDbClient(mockDb);
      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/coupons`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
          body: JSON.stringify({
            email: 'not-an-email',
            notes: '',
          }),
        },
        env,
      );
      expect(res.status).toBe(422);
    });

    it('creates coupon and returns 201 with masked email', async () => {
      const futureDate = new Date('2026-12-31T23:59:59.000Z');
      mockDb.limit.mockResolvedValueOnce([{ id: VALID_UUID }]); // experience found
      mockDb.returning.mockResolvedValueOnce([
        {
          id: 'coupon-1',
          experienceId: VALID_UUID,
          emailMasked: 'i***d@example.com',
          notes: 'Grupo Arquitectura',
          maxDownloads: 3,
          usedDownloads: 0,
          expiresAt: futureDate,
          createdAt: new Date(),
        },
      ]);
      setDbClient(mockDb);

      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/coupons`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
          body: JSON.stringify({
            email: 'invited@example.com',
            expiresAt: '2026-12-31T23:59:59.000Z',
            notes: 'Grupo Arquitectura',
            maxDownloads: 3,
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data).toMatchObject({
        id: 'coupon-1',
        emailMasked: 'i***d@example.com',
        notes: 'Grupo Arquitectura',
        maxDownloads: 3,
        usedDownloads: 0,
      });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  describe('GET /payments/experiences/:id/purchased (Coupon validation)', () => {
    it('returns 500 HMAC_SECRET_MISSING when HMAC_SECRET is missing', async () => {
      setDbClient(mockDb);

      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/purchased?email=unknown@example.com`,
        {
          headers: {
            'X-Device-Id': 'device-123',
            'X-Device-Platform': 'ios',
          },
        },
        { ...env, HMAC_SECRET: undefined },
      );

      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ code: 'HMAC_SECRET_MISSING' });
    });

    it('returns 400 PLATFORM_REQUIRED when X-Device-Platform is missing', async () => {
      setDbClient(mockDb);

      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/purchased?email=unknown@example.com`,
        {
          headers: {
            'X-Device-Id': 'device-123',
          },
        },
        env,
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'PLATFORM_REQUIRED' });
    });

    it('returns 404 COUPON_NOT_FOUND when email is not found in purchases nor coupons', async () => {
      mockDb.limit
        .mockResolvedValueOnce([{ published: true }]) // experience lookup
        .mockResolvedValueOnce([]) // purchases lookup
        .mockResolvedValueOnce([]); // coupons lookup
      setDbClient(mockDb);

      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/purchased?email=unknown@example.com`,
        {
          headers: {
            'X-Device-Id': 'device-123',
            'X-Device-Platform': 'ios',
          },
        },
        env,
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ code: 'COUPON_NOT_FOUND' });
    });

    it('returns 403 COUPON_EXPIRED when coupon expiresAt is in the past', async () => {
      const pastDate = new Date(Date.now() - 60000);
      mockDb.limit
        .mockResolvedValueOnce([{ published: true }]) // experience lookup
        .mockResolvedValueOnce([]) // purchases lookup
        .mockResolvedValueOnce([
          {
            id: 'coupon-expired',
            experienceId: VALID_UUID,
            usedDownloads: 0,
            maxDownloads: 1,
            expiresAt: pastDate,
          },
        ]);
      setDbClient(mockDb);

      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/purchased?email=user@example.com`,
        {
          headers: {
            'X-Device-Id': 'device-123',
            'X-Device-Platform': 'ios',
          },
        },
        env,
      );

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'COUPON_EXPIRED' });
    });

    it('returns 403 COUPON_LIMIT_REACHED when usedDownloads >= maxDownloads for a new device', async () => {
      const futureDate = new Date(Date.now() + 600000);
      mockDb.limit
        .mockResolvedValueOnce([{ published: true }]) // experience lookup
        .mockResolvedValueOnce([]) // purchases lookup
        .mockResolvedValueOnce([
          {
            id: 'coupon-maxed',
            experienceId: VALID_UUID,
            usedDownloads: 2,
            maxDownloads: 2,
            expiresAt: futureDate,
          },
        ]) // coupons lookup
        .mockResolvedValueOnce([]); // existing redemptions lookup (new device)
      setDbClient(mockDb);

      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/purchased?email=user@example.com`,
        {
          headers: {
            'X-Device-Id': 'new-device-999',
            'X-Device-Platform': 'android',
          },
        },
        env,
      );

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'COUPON_LIMIT_REACHED' });
    });

    it('grants access idempotently without incrementing quota when device already redeemed', async () => {
      const futureDate = new Date(Date.now() + 600000);
      mockDb.limit
        .mockResolvedValueOnce([{ published: true }]) // experience lookup
        .mockResolvedValueOnce([]) // purchases lookup
        .mockResolvedValueOnce([
          {
            id: 'coupon-1',
            experienceId: VALID_UUID,
            usedDownloads: 1,
            maxDownloads: 1,
            expiresAt: futureDate,
          },
        ]) // coupons lookup
        .mockResolvedValueOnce([{ id: 'redemption-existing' }]); // device already redeemed
      setDbClient(mockDb);

      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/purchased?email=user@example.com`,
        {
          headers: {
            'X-Device-Id': 'existing-device-123',
            'X-Device-Platform': 'ios',
          },
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        purchased: true,
      });
      // Should not increment usedDownloads or insert redemption again
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('redeems coupon for a new device, increments quota, and records redemption', async () => {
      const futureDate = new Date(Date.now() + 600000);
      mockDb.limit
        .mockResolvedValueOnce([{ published: true }]) // experience lookup
        .mockResolvedValueOnce([]) // purchases lookup
        .mockResolvedValueOnce([
          {
            id: 'coupon-1',
            experienceId: VALID_UUID,
            usedDownloads: 0,
            maxDownloads: 5,
            expiresAt: futureDate,
          },
        ]) // coupons lookup
        .mockResolvedValueOnce([]); // no existing redemption for this device
      setDbClient(mockDb);

      const res = await app.request(
        `/payments/experiences/${VALID_UUID}/purchased?email=user@example.com`,
        {
          headers: {
            'X-Device-Id': 'first-device-1',
            'X-Device-Platform': 'ios',
          },
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        purchased: true,
      });
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ usedDownloads: 1 });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          couponId: 'coupon-1',
          experienceId: VALID_UUID,
          deviceId: 'first-device-1',
          platform: 'ios',
        }),
      );
    });
  });
});
