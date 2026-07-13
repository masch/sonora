import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient, HttpError } from '../lib/http-client';

describe('HttpClient', () => {
  let client: HttpClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    client = new HttpClient({
      baseUrl: 'https://api.example.com',
      timeout: 5000,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('makes a GET request and returns parsed JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'abc', name: 'test' }),
        text: () => Promise.resolve(''),
      });

      const result = await client.get<{ id: string; name: string }>('/items/abc');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/items/abc',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.id).toBe('abc');
      expect(result.name).toBe('test');
    });

    it('includes default headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });

      await client.get('/items');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });

    it('includes custom config headers', async () => {
      const authedClient = new HttpClient({
        baseUrl: 'https://api.example.com',
        headers: { Authorization: 'Bearer token123' },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });

      await authedClient.get('/items');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
        }),
      );
    });
  });

  describe('post', () => {
    it('makes a POST request with JSON body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'new-id' }),
        text: () => Promise.resolve(''),
      });

      const result = await client.post<{ id: string }>('/items', { name: 'new' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'new' }),
        }),
      );
      expect(result.id).toBe('new-id');
    });

    it('sends POST without body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });

      await client.post('/items');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('throws HttpError on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
        text: () => Promise.resolve('Not found'),
      });

      await expect(client.get('/missing')).rejects.toThrow(HttpError);
      await expect(client.get('/missing')).rejects.toThrow('HTTP 404');
    });

    it('includes response body in HttpError', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
        text: () => Promise.resolve('Server error'),
      });

      try {
        await client.get('/error');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(500);
        expect((err as HttpError).body).toContain('Server error');
      }
    });

    it('handles 204 No Content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.reject(new Error('No content')),
        text: () => Promise.resolve(''),
      });

      const result = await client.get<undefined>('/no-content');
      expect(result).toBeUndefined();
    });

    it('throws HttpError on request timeout', async () => {
      // Simulate timeout by aborting
      mockFetch.mockImplementation(
        (_url: string, options: RequestInit & { signal?: AbortSignal }) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10);
          // The actual fetch would throw AbortError
          options.signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
          });
          return new Promise((_, reject) => {
            options.signal?.addEventListener('abort', () => {
              const err = new DOMException('The operation was aborted', 'AbortError');
              reject(err);
            });
          });
        },
      );

      const fastClient = new HttpClient({
        baseUrl: 'https://api.example.com',
        timeout: 5, // very short timeout
      });

      try {
        await fastClient.get('/slow');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(408);
        expect((err as HttpError).body).toContain('timeout');
      }
    }, 10000);
  });

  describe('request options', () => {
    it('merges custom headers with defaults', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });

      await client.get('/items', {
        headers: { 'X-Custom': 'value' },
      });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('application/json');
      expect(callArgs.headers['X-Custom']).toBe('value');
    });

    it('overrides Content-Type when custom header provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });

      await client.get('/items', {
        headers: { 'Content-Type': 'text/plain' },
      });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('text/plain');
    });
  });
});
