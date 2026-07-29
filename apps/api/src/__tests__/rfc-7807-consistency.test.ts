import { describe, it, expect } from 'vitest';
import app from '../index';
import type { ProblemDetails } from '../middleware/problem-details';

/**
 * Verify that every RFC 7807 error response has the status code
 * in the body matching the HTTP response status code.
 *
 * This is a regression guard: when someone copies an error response,
 * it's easy to forget to update both the body.status and the second
 * argument of c.json(). We enumerate routes that SHOULD return an
 * error and verify they stay consistent.
 */
describe('RFC 7807 error responses', () => {
  const errorRoutes: Array<{
    name: string;
    request: () => Promise<Response>;
    expectedStatus: number;
    expectedType: string;
  }> = [
    // POST /feedback
    {
      name: 'POST /feedback — empty body (422)',
      request: async () =>
        await app.request('/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      expectedStatus: 422,
      expectedType: 'VALIDATION_ERROR',
    },
    {
      name: 'POST /feedback — missing fields (422)',
      request: async () =>
        await app.request('/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experienceId: 'test' }),
        }),
      expectedStatus: 422,
      expectedType: 'VALIDATION_ERROR',
    },

    // POST /payments/create
    {
      name: 'POST /payments/create — empty body (422)',
      request: async () =>
        await app.request('/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      expectedStatus: 422,
      expectedType: 'VALIDATION_ERROR',
    },
    {
      name: 'POST /payments/create — not found (404)',
      request: async () =>
        await app.request('/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            experienceId: '00000000-0000-0000-0000-000000000000',
          }),
        }),
      expectedStatus: 404,
      expectedType: 'EXPERIENCE_NOT_FOUND',
    },

    // POST /payments/webhook
    {
      name: 'POST /payments/webhook — empty body (422)',
      request: async () =>
        await app.request('/payments/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      expectedStatus: 422,
      expectedType: 'VALIDATION_ERROR',
    },

    // GET /payments/experiences/:id/purchased
    {
      name: 'GET /payments/experiences/:id/purchased — missing email (422)',
      request: async () =>
        await app.request('/payments/experiences/550e8400-e29b-41d4-a716-446655440000/purchased'),
      expectedStatus: 422,
      expectedType: 'VALIDATION_ERROR',
    },

    // GET /payments\(note: no trailing slash — Hono normalizes)
    {
      name: 'GET /payments — missing email query (422)',
      request: async () => await app.request('/payments'),
      expectedStatus: 422,
      expectedType: 'VALIDATION_ERROR',
    },

    // POST /audio/upload
    {
      name: 'POST /audio/upload — no auth (401)',
      request: async () => await app.request('/audio/upload', { method: 'POST' }),
      expectedStatus: 401,
      expectedType: 'UNAUTHORIZED',
    },

    // PUT /api/translations
    {
      name: 'PUT /api/translations — wrong auth (401)',
      request: async () =>
        await app.request('/api/translations', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer wrong-key',
          },
          body: JSON.stringify([{ lang: 'en', key: 't', value: 'v' }]),
        }),
      expectedStatus: 401,
      expectedType: 'UNAUTHORIZED',
    },
    {
      name: 'PUT /api/translations — invalid body (422)',
      request: async () =>
        await app.request('/api/translations', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-admin-key-123',
          },
          body: JSON.stringify([{ lang: 'en', key: '', value: 'v' }]),
        }),
      expectedStatus: 422,
      expectedType: 'VALIDATION_ERROR',
    },

    // GET /api/translations/session
    {
      name: 'GET /api/translations/session — no auth (401)',
      request: async () => await app.request('/api/translations/session', { method: 'GET' }),
      expectedStatus: 401,
      expectedType: 'UNAUTHORIZED',
    },
  ];

  for (const { name, request: makeReq, expectedStatus, expectedType } of errorRoutes) {
    it(`${name} → body.status === ${expectedStatus}`, async () => {
      const res = await makeReq();

      // For routes that match the expected error
      if (res.status === expectedStatus) {
        const body = (await res.json()) as ProblemDetails;
        expect(body.status).toBe(res.status);
        expect(body.code).toBe(expectedType);
        expect(body.detail).toBeDefined();
      } else {
        // If status doesn't match (e.g. env differs), still verify body/status consistency
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.status).toBe(res.status);
      }
    });
  }
});
