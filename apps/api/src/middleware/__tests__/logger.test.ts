import { logger } from '@sonora/shared';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { customLogger } from '../logger';

vi.mock('@sonora/shared', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('customLogger middleware', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.use('*', customLogger());
  });

  it('logs GET requests without body', async () => {
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test');
    expect(res.status).toBe(200);

    // Verify request log
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Request] GET http://localhost/test'),
      expect.objectContaining({
        body: undefined,
      }),
    );

    // Verify response log
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] GET http://localhost/test - 200'),
      expect.objectContaining({
        status: 200,
        body: 'ok',
      }),
    );
  });

  it('does not log when ENABLE_API_LOGGING is false', async () => {
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test', {}, { ENABLE_API_LOGGING: 'false' });
    expect(res.status).toBe(200);

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('logs POST requests with valid JSON body', async () => {
    app.post('/submit', async (c) => {
      const body = await c.req.json();
      return c.json({ received: body });
    });

    const res = await app.request('/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'masch', role: 'admin' }),
    });

    expect(res.status).toBe(200);

    // Check request body was logged as parsed JSON
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Request] POST http://localhost/submit'),
      expect.objectContaining({
        body: { name: 'masch', role: 'admin' },
      }),
    );

    // Check response body was logged as parsed JSON
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] POST http://localhost/submit - 200'),
      expect.objectContaining({
        status: 200,
        body: { received: { name: 'masch', role: 'admin' } },
      }),
    );
  });

  it('handles malformed JSON request body gracefully without failing', async () => {
    app.post('/submit', (c) => c.text('fallback'));

    const res = await app.request('/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{invalid-json',
    });

    expect(res.status).toBe(200);

    // Should fall back to logging the raw body string rather than crashing
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Request] POST http://localhost/submit'),
      expect.objectContaining({
        body: '{invalid-json',
      }),
    );
  });

  it('handles non-JSON response bodies', async () => {
    app.get('/html', (c) => {
      c.header('content-type', 'text/html');
      return c.html('<h1>Hello</h1>');
    });

    const res = await app.request('/html');
    expect(res.status).toBe(200);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] GET http://localhost/html - 200'),
      expect.objectContaining({
        status: 200,
        body: '<h1>Hello</h1>',
      }),
    );
  });

  it('handles request body read failures gracefully', async () => {
    app.post('/error-body', (c) => c.text('ok'));

    const request = new Request('http://localhost/error-body', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"foo":"bar"}',
    });

    // Force clone() to throw an error
    vi.spyOn(request, 'clone').mockImplementation(() => {
      throw new Error('Clone failed');
    });

    const res = await app.request(request);
    expect(res.status).toBe(200);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read request body for logging'),
      expect.any(Error),
    );
  });

  it('handles raw Response objects gracefully without crashing', async () => {
    app.get('/raw-res', (_) => {
      return new Response('raw-content');
    });

    const res = await app.request('/raw-res');
    expect(res.status).toBe(200);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] GET http://localhost/raw-res - 200'),
      expect.objectContaining({
        status: 200,
        body: 'raw-content',
      }),
    );
  });

  it('does not disturb the response body stream for a real network client', async () => {
    const { serve } = await import('@hono/node-server');
    const testApp = new Hono();
    testApp.use('*', customLogger());
    testApp.get('/real-stream', (c) => c.json({ data: 'real-node-server-data' }));

    // Start a real node server on a random port
    const server = serve({
      fetch: testApp.fetch,
      port: 0,
      hostname: '127.0.0.1',
    });

    // Wait for server to bind
    await new Promise<void>((resolve) => {
      server.on('listening', resolve);
    });

    // Get the assigned port
    const address = server.address();
    const port = typeof address === 'string' ? 0 : address?.port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/real-stream`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ data: 'real-node-server-data' });
    } finally {
      server.close();
    }
  });
});
