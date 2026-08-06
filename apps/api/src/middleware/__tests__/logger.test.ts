import { logger } from '@sonora/shared';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { customLogger } from '../logger';

vi.mock('@sonora/shared', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/** Serialize every log call (message + metadata) so absence assertions are cheap and total. */
function serializedLogs(): string {
  const calls = [
    ...vi.mocked(logger.info).mock.calls,
    ...vi.mocked(logger.warn).mock.calls,
    ...vi.mocked(logger.error).mock.calls,
  ];
  return JSON.stringify(calls);
}

/** Find the first log call whose message includes the given prefix; returns its metadata. */
function logMeta(
  fn: Mock<(message: string, meta: unknown) => void>,
  messagePrefix: string,
): Record<string, unknown> {
  const call = fn.mock.calls.find(
    ([msg]) => typeof msg === 'string' && msg.includes(messagePrefix),
  );
  if (!call) throw new Error(`No log call found for message prefix: ${messagePrefix}`);
  return (call[1] ?? {}) as Record<string, unknown>;
}

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
        headers: expect.any(Object),
        query: {},
      }),
    );
    expect(
      logMeta(vi.mocked(logger.info), '[API Request] GET http://localhost/test'),
    ).not.toHaveProperty('body');

    // Verify response log — text/plain responses carry no body metadata
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] GET http://localhost/test - 200'),
      expect.objectContaining({
        status: 200,
      }),
    );
    expect(
      logMeta(vi.mocked(logger.info), '[API Response] GET http://localhost/test - 200'),
    ).not.toHaveProperty('body');
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
      body: JSON.stringify({
        name: 'masch',
        email: 'buyer@example.com',
        purchaseId: 'uuid-1',
        status: 'pending',
      }),
    });

    expect(res.status).toBe(200);

    // Request body is redacted to allowlisted fields only
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Request] POST http://localhost/submit'),
      expect.objectContaining({
        body: { purchaseId: 'uuid-1', status: 'pending' },
      }),
    );

    // Response body { received: {...} } has no allowlisted top-level fields → {}
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] POST http://localhost/submit - 200'),
      expect.objectContaining({
        status: 200,
        body: {},
      }),
    );

    // PII never appears anywhere in logged output
    expect(serializedLogs()).not.toContain('masch');
    expect(serializedLogs()).not.toContain('buyer@example.com');
  });

  it('handles malformed JSON request body gracefully', async () => {
    app.post('/submit', (c) => c.text('fallback'));

    const res = await app.request('/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{invalid-json',
    });

    expect(res.status).toBe(200);

    // Malformed JSON logs the omit marker, never the raw text
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Request] POST http://localhost/submit'),
      expect.objectContaining({
        body: '<unparseable-body>',
      }),
    );
    expect(serializedLogs()).not.toContain('{invalid-json');
  });

  it('handles non-JSON response bodies', async () => {
    app.get('/html', (c) => {
      c.header('content-type', 'text/html');
      return c.html('<h1>Hello</h1>');
    });

    const res = await app.request('/html');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<h1>Hello</h1>');

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] GET http://localhost/html - 200'),
      expect.objectContaining({
        status: 200,
      }),
    );
    expect(
      logMeta(vi.mocked(logger.info), '[API Response] GET http://localhost/html - 200'),
    ).not.toHaveProperty('body');
  });

  it('handles request body read failures gracefully', async () => {
    app.post('/error-body', (c) => c.text('ok'));

    const request = new Request('http://localhost/error-body?token=abc', {
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

    // Warn embeds the sanitized (query-stripped) URL and a name-only error arg
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to read request body for logging: POST http://localhost/error-body',
      ),
      { error: 'Error' },
    );
    expect(serializedLogs()).not.toContain('token=abc');
  });

  it('handles raw Response objects gracefully without crashing', async () => {
    app.get('/raw-res', (_) => {
      return new Response('raw-content');
    });

    const res = await app.request('/raw-res');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('raw-content');

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] GET http://localhost/raw-res - 200'),
      expect.objectContaining({
        status: 200,
      }),
    );
    expect(
      logMeta(vi.mocked(logger.info), '[API Response] GET http://localhost/raw-res - 200'),
    ).not.toHaveProperty('body');
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

  it('delivers sensitive JSON response bytes intact while never logging them', async () => {
    const { serve } = await import('@hono/node-server');
    const testApp = new Hono();
    testApp.use('*', customLogger());
    testApp.get('/sensitive-stream', (c) =>
      c.json({
        checkoutUrl: 'https://pay.example.com/checkout?signed=token123',
        status: 'approved',
      }),
    );

    const server = serve({
      fetch: testApp.fetch,
      port: 0,
      hostname: '127.0.0.1',
    });

    await new Promise<void>((resolve) => {
      server.on('listening', resolve);
    });

    const address = server.address();
    const port = typeof address === 'string' ? 0 : address?.port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/sensitive-stream`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        checkoutUrl: 'https://pay.example.com/checkout?signed=token123',
        status: 'approved',
      });
    } finally {
      server.close();
    }

    expect(serializedLogs()).not.toContain('token123');
    expect(serializedLogs()).not.toContain('checkoutUrl');
  });

  it('never logs auth header or cookie values', async () => {
    app.get('/secure', (c) => c.text('ok'));

    await app.request('/secure', {
      headers: {
        authorization: 'Bearer supersecret-token',
        cookie: 'session=supersecret-session',
      },
    });

    expect(serializedLogs()).not.toContain('supersecret-token');
    expect(serializedLogs()).not.toContain('supersecret-session');
  });

  it('strips the query string from log messages', async () => {
    app.get('/test', (c) => c.text('ok'));

    await app.request('/test?deviceId=abc123&email=buyer@example.com');

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Request] GET http://localhost/test'),
      expect.anything(),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Response] GET http://localhost/test - 200'),
      expect.anything(),
    );
    expect(serializedLogs()).not.toContain('deviceId=abc123');
    expect(serializedLogs()).not.toContain('buyer@example.com');
  });

  it('logs only allowlisted query params', async () => {
    app.get('/experiences', (c) => c.json([]));

    await app.request('/experiences?page=2&limit=10&sync=true');

    const reqMeta = logMeta(
      vi.mocked(logger.info),
      '[API Request] GET http://localhost/experiences',
    );
    expect(reqMeta.query).toEqual({ page: '2', limit: '10', sync: 'true' });
  });

  it('omits unknown query params from every log call', async () => {
    app.get('/payments/status/123', (c) => c.json({ status: 'pending' }));

    await app.request(
      '/payments/status/123?email=buyer@example.com&data.id=987&deviceId=dev-1&token=abc',
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Request] GET http://localhost/payments/status/123'),
      expect.anything(),
    );
    expect(serializedLogs()).not.toContain('data.id');
    expect(serializedLogs()).not.toContain('deviceId=dev-1');
    expect(serializedLogs()).not.toContain('token=abc');
    expect(serializedLogs()).not.toContain('buyer@example.com');
  });

  it('logs only allowlisted headers', async () => {
    app.get('/headers', (c) => c.text('ok'));

    await app.request('/headers', {
      headers: {
        authorization: 'Bearer secret-token',
        cookie: 'session=abc',
        'x-api-key': 'key123',
        'x-device-id': 'dev-1',
        'content-type': 'application/json',
        'user-agent': 'SonoraApp/1.0',
        'x-request-id': 'req-123',
      },
    });

    const reqMeta = logMeta(vi.mocked(logger.info), '[API Request] GET http://localhost/headers');
    expect(reqMeta.headers).toEqual(
      expect.objectContaining({
        'content-type': 'application/json',
        'user-agent': 'SonoraApp/1.0',
        'x-request-id': 'req-123',
      }),
    );
    expect(reqMeta.headers).not.toHaveProperty('authorization');
    expect(reqMeta.headers).not.toHaveProperty('cookie');
    expect(reqMeta.headers).not.toHaveProperty('x-api-key');
    expect(reqMeta.headers).not.toHaveProperty('x-device-id');
  });

  it('never logs a signed URL token embedded in the query string', async () => {
    app.get('/audio', (c) => c.text('ok'));

    await app.request('/audio?url=https%3A%2F%2Fcdn.example.com%2Fa.mp3%3Ftoken%3Dsignedsecret');

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[API Request] GET http://localhost/audio'),
      expect.anything(),
    );
    expect(serializedLogs()).not.toContain('signedsecret');
  });

  it('does not log form-encoded request bodies', async () => {
    app.post('/form', (c) => c.text('ok'));

    await app.request('/form', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=buyer@example.com&token=abc',
    });

    const reqMeta = logMeta(vi.mocked(logger.info), '[API Request] POST http://localhost/form');
    expect(reqMeta).not.toHaveProperty('body');
    expect(serializedLogs()).not.toContain('buyer@example.com');
    expect(serializedLogs()).not.toContain('token=abc');
  });

  it('redacts sensitive response fields to allowlisted ones only', async () => {
    app.get('/payments/purchase', (c) =>
      c.json({
        checkoutUrl: 'https://pay.example.com/checkout?signed=token123',
        token: 'jwt-abc',
        providerPaymentId: '123',
        status: 'approved',
      }),
    );

    await app.request('/payments/purchase');

    const resMeta = logMeta(
      vi.mocked(logger.info),
      '[API Response] GET http://localhost/payments/purchase - 200',
    );
    expect(resMeta.body).toEqual({ providerPaymentId: '123', status: 'approved' });
    expect(serializedLogs()).not.toContain('checkoutUrl');
    expect(serializedLogs()).not.toContain('jwt-abc');
    expect(serializedLogs()).not.toContain('token123');
  });
});
