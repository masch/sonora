import { ApiClient } from '../api-client';
import { getItem, setItem } from '@/storage/feedback-storage';
import { logger } from '@/utils/logger';

jest.mock('@/storage/feedback-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function mockFetchOk(data: unknown) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
  });
}

function mockFetchFail(status: number) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn().mockResolvedValue({ error: 'fail' }),
  });
}

function mockFetchNetworkError(message = 'Network Error') {
  globalThis.fetch = jest.fn().mockRejectedValue(new Error(message));
}

describe('ApiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  /* ─── URL construction ─── */

  it('prepends apiBaseUrl for relative paths', async () => {
    mockFetchOk({ ok: true });

    await ApiClient.get('/relative', { skipCache: true });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/relative'),
      expect.anything(),
    );
  });

  it('uses absolute URL as-is when path starts with http', async () => {
    mockFetchOk({ ok: true });

    await ApiClient.get('https://cdn.example.com/data.json', { skipCache: true });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://cdn.example.com/data.json',
      expect.anything(),
    );
  });

  /* ─── Headers ─── */

  it('sets Content-Type to application/json by default', async () => {
    mockFetchOk({});

    await ApiClient.get('/test', { skipCache: true });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('merges custom headers with defaults', async () => {
    mockFetchOk({});

    await ApiClient.get('/test', {
      skipCache: true,
      headers: { Authorization: 'Bearer tok' },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok',
        }),
      }),
    );
  });

  /* ─── Body serialization ─── */

  it('serializes object body to JSON string', async () => {
    mockFetchOk({ created: true });

    await ApiClient.post('/submit', { foo: 'bar' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ foo: 'bar' }) }),
    );
  });

  it('passes string body through without double-serializing', async () => {
    mockFetchOk({ created: true });
    const rawBody = '{"already":"serialized"}';

    await ApiClient.post('/submit', rawBody);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: rawBody }),
    );
  });

  it('does not set body on fetchConfig when body is undefined', async () => {
    mockFetchOk({});

    await ApiClient.get('/test', { skipCache: true });

    const callArgs = (globalThis.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.body).toBeUndefined();
  });

  /* ─── GET without caching (non-cached path) ─── */

  it('performs a successful GET request without caching', async () => {
    const mockData = { success: true };
    mockFetchOk(mockData);

    const result = await ApiClient.get('/test-route', { skipCache: true });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-route'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(mockData);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('throws on non-ok response in non-cached path', async () => {
    mockFetchFail(502);

    await expect(ApiClient.get('/fail', { skipCache: true })).rejects.toThrow(
      'Request failed with status 502',
    );
  });

  it('uses customErrorMessage on non-ok response in non-cached path', async () => {
    mockFetchFail(503);

    await expect(
      ApiClient.request('/fail', { method: 'GET', skipCache: true, customErrorMessage: 'Boom' }),
    ).rejects.toThrow('Boom');
  });

  /* ─── GET with caching (cached path) ─── */

  it('caches response on successful GET with cacheKey', async () => {
    const mockData = { id: 1 };
    mockFetchOk(mockData);

    const result = await ApiClient.get('/data', { cacheKey: 'k1' });

    expect(result).toEqual(mockData);
    expect(setItem).toHaveBeenCalledWith('k1', JSON.stringify(mockData));
  });

  it('falls back to cache when network fails and cacheKey is provided', async () => {
    const cached = { fromCache: true };
    mockFetchNetworkError();
    (getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));

    const result = await ApiClient.get('/data', { cacheKey: 'k1' });

    expect(result).toEqual(cached);
    expect(getItem).toHaveBeenCalledWith('k1');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[Offline Mode]'));
  });

  it('falls back to cache when server returns non-ok status with cacheKey', async () => {
    const cached = { fromCache: true };
    mockFetchFail(500);
    (getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));

    const result = await ApiClient.get('/data', { cacheKey: 'k1' });

    expect(result).toEqual(cached);
  });

  it('throws original error when network fails and cache is empty', async () => {
    mockFetchNetworkError('Connection refused');
    (getItem as jest.Mock).mockResolvedValue(null);

    await expect(ApiClient.get('/data', { cacheKey: 'k1' })).rejects.toThrow('Connection refused');
  });

  it('throws original error when network fails and cache read throws', async () => {
    mockFetchNetworkError('Offline');
    (getItem as jest.Mock).mockRejectedValue(new Error('SQLite locked'));

    await expect(ApiClient.get('/data', { cacheKey: 'k1' })).rejects.toThrow('Offline');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to read cache'));
  });

  it('uses customErrorMessage when server returns non-ok in cached path', async () => {
    mockFetchFail(404);
    (getItem as jest.Mock).mockResolvedValue(null);

    await expect(
      ApiClient.get('/missing', { cacheKey: 'k1', customErrorMessage: 'Not found' }),
    ).rejects.toThrow('Not found');
  });

  it('logs warning but still returns data when setItem fails', async () => {
    const mockData = { id: 1 };
    mockFetchOk(mockData);
    (setItem as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));

    const result = await ApiClient.get('/data', { cacheKey: 'k1' });

    expect(result).toEqual(mockData);
    // Wait for the async catch to fire
    await new Promise((r) => setTimeout(r, 10));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to write cache'));
  });

  /* ─── transform option ─── */

  it('applies transform to response data before caching', async () => {
    const rawData = [
      { id: 1, active: true },
      { id: 2, active: false },
    ];
    mockFetchOk(rawData);
    const onlyActive = (data: { active: boolean }[]) => data.filter((d) => d.active);

    const result = await ApiClient.get('/items', {
      cacheKey: 'items',
      transform: onlyActive,
    });

    expect(result).toEqual([{ id: 1, active: true }]);
    expect(setItem).toHaveBeenCalledWith('items', JSON.stringify([{ id: 1, active: true }]));
  });

  /* ─── response.ok fallback ─── */

  it('falls back to status-based check when response.ok is undefined', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: undefined,
      status: 201,
      json: jest.fn().mockResolvedValue({ created: true }),
    });

    const result = await ApiClient.post('/submit', { a: 1 });

    expect(result).toEqual({ created: true });
  });

  it('rejects via status-based check when response.ok is undefined and status >= 300', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: undefined,
      status: 400,
      json: jest.fn(),
    });

    await expect(ApiClient.post('/submit', {})).rejects.toThrow('Request failed with status 400');
  });

  /* ─── POST ─── */

  it('performs a successful POST request', async () => {
    const mockData = { created: true };
    mockFetchOk(mockData);

    const result = await ApiClient.post('/submit', { foo: 'bar' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/submit'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      }),
    );
    expect(result).toEqual(mockData);
  });

  it('throws on failed POST request', async () => {
    mockFetchFail(422);

    await expect(ApiClient.post('/submit', { bad: 'data' })).rejects.toThrow(
      'Request failed with status 422',
    );
  });

  /* ─── Branch: default options parameter (L15) ─── */

  it('works when request is called without options argument', async () => {
    mockFetchOk({ data: true });

    const result = await ApiClient.request('/no-opts');

    expect(result).toEqual({ data: true });
  });

  /* ─── Branch: response.ok undefined in cached GET path (L38) ─── */

  it('uses status-based ok check in cached GET path when response.ok is undefined', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: undefined,
      status: 200,
      json: jest.fn().mockResolvedValue({ cached: 'ok-undefined' }),
    });

    const result = await ApiClient.get('/data', { cacheKey: 'ok-undef' });

    expect(result).toEqual({ cached: 'ok-undefined' });
    expect(setItem).toHaveBeenCalledWith('ok-undef', JSON.stringify({ cached: 'ok-undefined' }));
  });

  /* ─── Branch: non-Error thrown by setItem catch (L47) ─── */

  it('handles non-Error rejection from setItem using String()', async () => {
    mockFetchOk({ id: 1 });
    (setItem as jest.Mock).mockRejectedValueOnce('string error');

    const result = await ApiClient.get('/data', { cacheKey: 'k1' });

    expect(result).toEqual({ id: 1 });
    await new Promise((r) => setTimeout(r, 10));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  /* ─── Branch: non-Error thrown by getItem catch (L60) ─── */

  it('handles non-Error rejection from getItem using String()', async () => {
    mockFetchNetworkError('Offline');
    (getItem as jest.Mock).mockRejectedValue('not an error object');

    await expect(ApiClient.get('/data', { cacheKey: 'k1' })).rejects.toThrow('Offline');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not an error object'));
  });
});
