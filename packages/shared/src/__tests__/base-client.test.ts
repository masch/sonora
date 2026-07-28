import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseApiClient, ApiError } from '../api/base-client';

describe('BaseApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('serializes JSON request bodies and parses JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    globalThis.fetch = fetchMock;

    const client = new BaseApiClient({ baseUrl: 'https://api.test' });
    const response = await client.request<{ success: boolean }>('/data', {
      method: 'POST',
      body: { name: 'Sonora' },
    });

    expect(response).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/data',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Sonora' }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('handles string bodies without double-serialization', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    globalThis.fetch = fetchMock;

    const client = new BaseApiClient({ baseUrl: 'https://api.test' });
    await client.request('/data', {
      method: 'POST',
      body: 'already-serialized-string',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/data',
      expect.objectContaining({
        body: 'already-serialized-string',
      }),
    );
  });

  it('throws ApiError for non-ok HTTP responses and extracts json error bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'invalid_payload' }),
    });
    globalThis.fetch = fetchMock;

    const client = new BaseApiClient({ baseUrl: 'https://api.test' });

    await expect(client.request('/data')).rejects.toThrow(ApiError);

    try {
      await client.request('/data');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.statusText).toBe('Bad Request');
      expect(apiErr.body).toEqual({ error: 'invalid_payload' });
    }
  });

  it('falls back to text error body if json parsing fails on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.reject(new Error('no json')),
      text: () => Promise.resolve('Raw text error'),
    });
    globalThis.fetch = fetchMock;

    const client = new BaseApiClient({ baseUrl: 'https://api.test' });

    try {
      await client.request('/data');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.body).toBe('Raw text error');
    }
  });

  it('falls back to undefined if both json and text fail on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.reject(new Error('no json')),
      text: () => Promise.reject(new Error('no text')),
    });
    globalThis.fetch = fetchMock;

    const client = new BaseApiClient({ baseUrl: 'https://api.test' });

    try {
      await client.request('/data');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.body).toBeUndefined();
    }
  });

  it('falls back to undefined if response has no json or text methods', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });
    globalThis.fetch = fetchMock;

    const client = new BaseApiClient({ baseUrl: 'https://api.test' });

    try {
      await client.request('/data');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.body).toBeUndefined();
    }
  });

  it('injects Authorization header dynamically (async and sync)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    globalThis.fetch = fetchMock;

    const clientAsync = new BaseApiClient({
      baseUrl: 'https://api.test',
      getAuthToken: () => Promise.resolve('async-token'),
    });
    await clientAsync.request('/data');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.test/data',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer async-token' }),
      }),
    );

    const clientSync = new BaseApiClient({
      baseUrl: 'https://api.test',
      getAuthToken: () => 'sync-token',
    });
    await clientSync.request('/data');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.test/data',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sync-token' }),
      }),
    );

    const clientNull = new BaseApiClient({
      baseUrl: 'https://api.test',
      getAuthToken: () => null,
    });
    await clientNull.request('/data');
    const headers = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it('uses offline caching fallback on fetch failure and logs to configured logs', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network offline'));
    globalThis.fetch = fetchMock;

    const storageMock = {
      getItem: vi.fn().mockResolvedValue(JSON.stringify({ cached: 'data' })),
      setItem: vi.fn().mockResolvedValue(undefined),
    };

    const logInfoMock = vi.fn();
    const client = new BaseApiClient({
      baseUrl: 'https://api.test',
      storage: storageMock,
      logInfo: logInfoMock,
    });

    const response = await client.request<{ cached: string }>('/data', {
      cacheKey: 'my-cache-key',
    });

    expect(response).toEqual({ cached: 'data' });
    expect(logInfoMock).toHaveBeenCalledWith(expect.stringContaining('[Offline Mode]'));
  });

  it('handles non-ok response in cache path and falls back to cache or throws ApiError', async () => {
    // 1. Non-ok response, cache is empty -> throws ApiError
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'db_down' }),
    });
    globalThis.fetch = fetchMock;

    const storageMockEmpty = {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
    };

    const clientEmpty = new BaseApiClient({
      baseUrl: 'https://api.test',
      storage: storageMockEmpty,
    });

    await expect(clientEmpty.request('/data', { cacheKey: 'k1' })).rejects.toThrow(ApiError);

    // 2. Non-ok response, cache exists -> returns cached data
    const storageMockCached = {
      getItem: vi.fn().mockResolvedValue(JSON.stringify({ cached: 'data' })),
      setItem: vi.fn().mockResolvedValue(undefined),
    };

    const clientCached = new BaseApiClient({
      baseUrl: 'https://api.test',
      storage: storageMockCached,
    });

    const result = await clientCached.request<{ cached: string }>('/data', { cacheKey: 'k2' });
    expect(result).toEqual({ cached: 'data' });
  });

  it('logs warning when setItem fails and logs error when getItem fails (using default consoles)', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // setItem failure
    const fetchMockOk = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'fresh' }),
    });
    globalThis.fetch = fetchMockOk;

    const storageMockFailSet = {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockRejectedValue(new Error('Disk full')),
    };

    const client1 = new BaseApiClient({
      baseUrl: 'https://api.test',
      storage: storageMockFailSet,
    });

    await client1.request('/data', { cacheKey: 'k1' });
    // Wait for the async setItem catch block to execute
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Failed to write cache'),
    );

    // getItem failure
    const fetchMockFail = vi.fn().mockRejectedValue(new Error('Network fail'));
    globalThis.fetch = fetchMockFail;

    const storageMockFailGet = {
      getItem: vi.fn().mockRejectedValue(new Error('Disk corrupted')),
      setItem: vi.fn().mockResolvedValue(undefined),
    };

    const client2 = new BaseApiClient({
      baseUrl: 'https://api.test',
      storage: storageMockFailGet,
    });

    await expect(client2.request('/data', { cacheKey: 'k2' })).rejects.toThrow('Network fail');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('[Offline Mode]'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Failed to read cache'),
    );
  });

  it('supports custom loggers for warn and error on cache errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network fail'));
    globalThis.fetch = fetchMock;

    const logErrorMock = vi.fn();
    const storageMock = {
      getItem: vi.fn().mockRejectedValue(new Error('Disk read fail')),
      setItem: vi.fn().mockResolvedValue(undefined),
    };

    const client = new BaseApiClient({
      baseUrl: 'https://api.test',
      storage: storageMock,
      logError: logErrorMock,
    });

    await expect(client.request('/data', { cacheKey: 'k1' })).rejects.toThrow('Network fail');
    expect(logErrorMock).toHaveBeenCalledWith(expect.stringContaining('Failed to read cache'));

    // Test warning callback
    const fetchMockOk = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    globalThis.fetch = fetchMockOk;

    const logWarningMock = vi.fn();
    const storageMockWarn = {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockRejectedValue(new Error('Disk write fail')),
    };

    const client2 = new BaseApiClient({
      baseUrl: 'https://api.test',
      storage: storageMockWarn,
      logWarning: logWarningMock,
    });

    await client2.request('/data', { cacheKey: 'k2' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(logWarningMock).toHaveBeenCalledWith(expect.stringContaining('Failed to write cache'));
  });

  it('supports get, post, put, delete methods', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    globalThis.fetch = fetchMock;

    const client = new BaseApiClient({ baseUrl: 'https://api.test' });

    const getRes = await client.get<{ success: boolean }>('/data');
    expect(getRes).toEqual({ success: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.test/data',
      expect.objectContaining({ method: 'GET' }),
    );

    const postRes = await client.post<{ success: boolean }>('/data', { val: 1 });
    expect(postRes).toEqual({ success: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.test/data',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ val: 1 }) }),
    );

    const putRes = await client.put<{ success: boolean }>('/data', { val: 2 });
    expect(putRes).toEqual({ success: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.test/data',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ val: 2 }) }),
    );

    const deleteRes = await client.delete<{ success: boolean }>('/data');
    expect(deleteRes).toEqual({ success: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.test/data',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
