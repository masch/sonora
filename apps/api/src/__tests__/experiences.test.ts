import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { eq } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
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
      geoMode: 'formatDefaultRadius',
      radiusMeters: null,
      latitude: -34.6,
      longitude: -58.4,
      published: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: {
        experiences: {
          findFirst: vi.fn().mockResolvedValue(expMock[0]),
        },
      },
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
      geoMode: 'formatDefaultRadius',
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
      query: {
        experiences: {
          findFirst: vi.fn().mockResolvedValue(undefined),
        },
      },
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
      query: {
        experiences: {
          findFirst: vi.fn().mockResolvedValue(undefined),
        },
      },
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
        geoMode: 'formatDefaultRadius',
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
    expect(body[0]).toHaveProperty('geoMode', 'formatDefaultRadius');
    expect(body[0]).toHaveProperty('radiusMeters', null);
  });

  it('surfaces credits on experience via the ...exp spread', async () => {
    const expMock = [
      {
        id: 'exp-credits',
        title: 'Credits Trip',
        free: true,
        audioUrl: 'free-audio.mp3',
        published: true,
        credits: [
          { role: 'Realización', names: 'Grupo Arquitectura del juego' },
          { role: 'Edición musical', names: 'Max Delanian' },
        ],
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
    expect(body[0]).toHaveProperty('credits');
    expect(body[0].credits).toEqual([
      { role: 'Realización', names: 'Grupo Arquitectura del juego' },
      { role: 'Edición musical', names: 'Max Delanian' },
    ]);
  });

  it('lists experiences and maps waypoints and free audio urls', async () => {
    const expMock = [
      { id: 'exp-1', title: 'Free Trip', free: true, audioUrl: 'free-audio.mp3', published: true },
      { id: 'exp-2', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3', published: true },
    ];
    const waypointsMock: any[] = [];
    const accessesMock: any[] = [];
    const purchasesMock: any[] = [];
    const freeDownloadsMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      if (queryCallCount === 4) return Promise.resolve(freeDownloadsMock).then(resolve);
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
    const freeDownloadsMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      if (queryCallCount === 4) return Promise.resolve(freeDownloadsMock).then(resolve);
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
    const freeDownloadsMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      if (queryCallCount === 4) return Promise.resolve(freeDownloadsMock).then(resolve);
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
    const freeDownloadsMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      if (queryCallCount === 4) return Promise.resolve(freeDownloadsMock).then(resolve);
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

  it('grants access if email matches registered free_downloads record', async () => {
    const expMock = [
      { id: 'exp-paid', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3' },
    ];
    const accessesMock: any[] = [];
    const purchasesMock: any[] = [];
    const freeDownloadsMock = [{ experienceId: 'exp-paid' }];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      if (queryCallCount === 4) return Promise.resolve(freeDownloadsMock).then(resolve);
      return Promise.resolve([]).then(resolve);
    });

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences?email=freedownload@example.com',
      {
        headers: { 'X-Device-Id': '770e8400-e29b-4a4a-a716-446655440002' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body[0].audioUrl).toContain('/audio/stream?key=paid-audio.mp3');
  });

  it('denies access if purchase status is pending or rejected and not in free_downloads', async () => {
    const expMock = [
      { id: 'exp-paid', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3' },
    ];
    const accessesMock: any[] = [];
    const purchasesMock: any[] = [];
    const freeDownloadsMock: any[] = [];

    let queryCallCount = 0;
    mockDb.then = vi.fn().mockImplementation((resolve) => {
      queryCallCount++;
      if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
      if (queryCallCount === 2) return Promise.resolve(accessesMock).then(resolve);
      if (queryCallCount === 3) return Promise.resolve(purchasesMock).then(resolve);
      if (queryCallCount === 4) return Promise.resolve(freeDownloadsMock).then(resolve);
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

describe('GET /experiences reference documents', () => {
  let mockDb: any;
  const env = {
    JWT_SECRET: 'test-jwt-secret',
    AUDIO_LINK_EXPIRY_SECONDS: '900',
  };
  const collection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
        properties: { labelKey: 'map.references.taller' },
      },
    ],
  };

  afterEach(() => {
    setDbClient(null);
  });

  it('returns published global and bound documents, and skips bindings of unpublished ones', async () => {
    const expMock = [{ id: 'exp-1', title: 'Trip', free: true, audioUrl: null, published: true }];
    const publishedDocuments = [
      { id: 'doc-global', key: 'bosque', scope: 'global', zIndex: 0, version: 1, collection },
      { id: 'doc-bound', key: 'sendero', scope: 'experience', zIndex: 0, version: 2, collection },
    ];
    // A binding to a document that is not in the published set must be ignored.
    const bindings = [
      { documentId: 'doc-bound', experienceId: 'exp-1' },
      { documentId: 'doc-unpublished', experienceId: 'exp-1' },
    ];

    let queryCallCount = 0;
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) => {
        queryCallCount++;
        if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
        if (queryCallCount === 5) return Promise.resolve(publishedDocuments).then(resolve);
        if (queryCallCount === 6) return Promise.resolve(bindings).then(resolve);
        return Promise.resolve([]).then(resolve);
      }),
    };

    setDbClient(mockDb);

    const res = await app.request(
      '/experiences',
      { headers: { 'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000' } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(1);
    expect(body[0].mapDocuments.map((document: { key: string }) => document.key)).toEqual([
      'bosque',
      'sendero',
    ]);
    expect(body[0].mapDocuments[1].version).toBe(2);
  });

  it('bounds the document bindings query to the experiences it returns', async () => {
    const expMock = [
      { id: 'exp-in-payload', title: 'Trip', free: true, audioUrl: null, published: true },
    ];

    let queryCallCount = 0;
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) => {
        queryCallCount += 1;
        if (queryCallCount === 1) return Promise.resolve(expMock).then(resolve);
        return Promise.resolve([]).then(resolve);
      }),
    };
    setDbClient(mockDb);

    const res = await app.request(
      '/experiences',
      { headers: { 'X-Device-Id': '550e8400-e29b-4a4a-a716-446655440000' } },
      env,
    );
    expect(res.status).toBe(200);

    const dialect = new PgDialect();
    const boundByPayload = (mockDb.where as Mock).mock.calls
      .map((call: unknown[]) => dialect.sqlToQuery(call[0] as never))
      .filter((query) => query.sql.includes(' in ') && query.params.includes('exp-in-payload'));

    expect(boundByPayload).toHaveLength(1);
    expect(boundByPayload[0].sql).toContain('experience_id');
  });
});
