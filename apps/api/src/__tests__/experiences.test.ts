import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app, { setDbClient } from '../index';

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
    expect(await res.json()).toEqual({ error: 'Device ID is required' });
  });

  it('lists experiences and maps waypoints and free audio urls', async () => {
    const expMock = [
      { id: 'exp-1', title: 'Free Trip', free: true, audioUrl: 'free-audio.mp3' },
      { id: 'exp-2', title: 'Paid Trip', free: false, audioUrl: 'paid-audio.mp3' },
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
        headers: { 'X-Device-Id': 'device-123' },
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
        headers: { 'X-Device-Id': 'device-123' },
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
        headers: { 'X-Device-Id': 'device-123' },
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
        headers: { 'X-Device-Id': 'device-new-phone' },
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
        headers: { 'X-Device-Id': 'device-123' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body[0].audioUrl).toBeNull();
  });
});
