import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import app, { setDbClient } from '../index';
import { experiences } from '../db/schema';
import { DEFAULT_REMOTE_CONFIG, resolveProximity } from '@sonora/shared';

describe('POST /experiences/:id/proximity', () => {
  let mockDb: any;
  const env = {
    JWT_SECRET: 'test-jwt-secret',
    AUDIO_LINK_EXPIRY_SECONDS: '900',
  };
  const DEVICE_HEADERS = {
    'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000',
    'content-type': 'application/json',
  };

  const expMock = [
    {
      id: 'exp-1',
      format: 'trip',
      geoMode: 'type',
      radiusMeters: null,
      latitude: -34.6,
      longitude: -58.4,
      published: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) => Promise.resolve(expMock).then(resolve)),
    };
  });

  afterEach(() => {
    setDbClient(null);
  });

  it('returns exactly { canListen, distanceMeters, effectiveRadiusMeters } via the shared resolver', async () => {
    setDbClient(mockDb);
    const user = { latitude: 10, longitude: 10 };
    const expected = resolveProximity({
      user,
      origin: { latitude: -34.6, longitude: -58.4 },
      format: 'trip',
      geoMode: 'type',
      radiusMeters: null,
      bypassGeofence: DEFAULT_REMOTE_CONFIG.geofence.bypassGeofence,
      geofence: DEFAULT_REMOTE_CONFIG.geofence,
    });

    const res = await app.request(
      '/experiences/exp-1/proximity',
      {
        method: 'POST',
        headers: DEVICE_HEADERS,
        body: JSON.stringify(user),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      canListen: boolean;
      distanceMeters: number | null;
      effectiveRadiusMeters: number | null;
    };
    expect(body).toEqual({
      canListen: expected.canListen,
      distanceMeters: expected.distanceMeters,
      effectiveRadiusMeters: expected.effectiveRadiusMeters,
    });
  });

  it('rejects out-of-range latitude', async () => {
    setDbClient(mockDb);
    const res = await app.request(
      '/experiences/exp-1/proximity',
      {
        method: 'POST',
        headers: DEVICE_HEADERS,
        body: JSON.stringify({ latitude: 91, longitude: 10 }),
      },
      env,
    );
    expect(res.status).toBe(422);
  });

  it('rejects out-of-range longitude', async () => {
    setDbClient(mockDb);
    const res = await app.request(
      '/experiences/exp-1/proximity',
      {
        method: 'POST',
        headers: DEVICE_HEADERS,
        body: JSON.stringify({ latitude: 10, longitude: -181 }),
      },
      env,
    );
    expect(res.status).toBe(422);
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const emptyDb: any = {
      ...mockDb,
      then: vi.fn().mockImplementation((resolve) => Promise.resolve([]).then(resolve)),
    };
    setDbClient(emptyDb);
    const res = await app.request(
      '/experiences/does-not-exist/proximity',
      {
        method: 'POST',
        headers: DEVICE_HEADERS,
        body: JSON.stringify({ latitude: 10, longitude: 10 }),
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('returns 404 NOT_FOUND when the experience is unpublished', async () => {
    const emptyUnpublishedDb: any = {
      ...mockDb,
      then: vi.fn().mockImplementation((resolve) => Promise.resolve([]).then(resolve)),
    };
    setDbClient(emptyUnpublishedDb);
    const res = await app.request(
      '/experiences/exp-1/proximity',
      {
        method: 'POST',
        headers: DEVICE_HEADERS,
        body: JSON.stringify({ latitude: 10, longitude: 10 }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /experiences', () => {
  let mockDb: any;
  const env = {
    JWT_SECRET: 'test-jwt-secret',
    AUDIO_LINK_EXPIRY_SECONDS: '900',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    setDbClient(null);
  });

  it('returns 400 Device ID is required when X-Device-Id header is missing', async () => {
    setDbClient(mockDb);
    const res = await app.request('/experiences', {}, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'DEVICE_ID_REQUIRED', status: 400 });
  });

  it('filters out unpublished experiences via where(eq(published, true)) and exposes the published field', async () => {
    const expMock = [
      { id: 'exp-1', title: 'Free Trip', free: true, audioUrl: 'free-audio.mp3', published: true },
      { id: 'exp-2', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3', published: true },
    ];
    const waypointsMock: any[] = [];
    const accessesMock: any[] = [];
    const purchasesMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      return Promise.resolve(waypointsMock).then(resolve);
    });

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences',
      {
        headers: { 'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockDb.where).toHaveBeenCalledWith(eq(experiences.published, true));
    const body = (await res.json()) as any[];
    expect(body[0].published).toBe(true);
  });

  it('surfaces geoMode and radiusMeters on every experience via the ...exp spread', async () => {
    const expMock = [
      {
        id: 'exp-geo',
        title: 'Geo Trip',
        free: true,
        audioUrl: 'free-audio.mp3',
        published: true,
        geoMode: 'type',
        radiusMeters: null,
      },
    ];
    const waypointsMock: any[] = [];
    const accessesMock: any[] = [];
    const purchasesMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      return Promise.resolve(waypointsMock).then(resolve);
    });

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences',
      {
        headers: { 'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(1);
    expect(body[0]).toHaveProperty('geoMode', 'type');
    expect(body[0]).toHaveProperty('radiusMeters', null);
  });

  it('lists experiences and maps waypoints and free audio urls', async () => {
    const expMock = [
      { id: 'exp-1', title: 'Free Trip', free: true, audioUrl: 'free-audio.mp3', published: true },
      { id: 'exp-2', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3', published: true },
    ];
    const waypointsMock: any[] = [];
    const accessesMock: any[] = [];
    const purchasesMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      return Promise.resolve(waypointsMock).then(resolve);
    });

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences',
      {
        headers: { 'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toBeInstanceOf(Array);
    expect(body).toHaveLength(2);

    expect(body[0].audioUrl).toContain('/audio/stream?key=free-audio.mp3');
    expect(body[1].audioUrl).toBeNull();
  });

  it('grants access to paid experience if device has access log', async () => {
    const expMock = [
      { id: 'exp-paid', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3' },
    ];
    const accessesMock = [{ experienceId: 'exp-paid' }];
    const purchasesMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      return Promise.resolve([]).then(resolve);
    });

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences',
      {
        headers: { 'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body[0].audioUrl).toContain('/audio/stream?key=paid-audio.mp3');
  });

  it('grants access to paid experience if device has approved purchase record', async () => {
    const expMock = [
      { id: 'exp-paid', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3' },
    ];
    const accessesMock: any[] = [];
    const purchasesMock = [{ experienceId: 'exp-paid' }];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      return Promise.resolve([]).then(resolve);
    });

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences',
      {
        headers: { 'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body[0].audioUrl).toContain('/audio/stream?key=paid-audio.mp3');
  });

  it('grants access if email matches approved purchase even if device ID differs', async () => {
    const expMock = [
      { id: 'exp-paid', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3' },
    ];
    const accessesMock: any[] = [];
    const purchasesMock = [{ experienceId: 'exp-paid' }];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      return Promise.resolve([]).then(resolve);
    });

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences?email=user@example.com',
      {
        headers: { 'X-Device-Id': '660e8400-e29b-4a4a-a716-446655440001' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body[0].audioUrl).toContain('/audio/stream?key=paid-audio.mp3');
  });

  it('denies access if purchase status is pending or rejected', async () => {
    const expMock = [
      { id: 'exp-paid', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3' },
    ];
    const accessesMock: any[] = [];
    const purchasesMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      return Promise.resolve([]).then(resolve);
    });

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences?email=user@example.com',
      {
        headers: { 'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body[0].audioUrl).toBeNull();
  });
});
