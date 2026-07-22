import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { EmailQuerySchema } from '@sonora/shared';
import { validationHook } from '../../middleware/validation-error';
import type { ProblemDetails } from '../../middleware/problem-details';

describe('validationHook integration with zValidator', () => {
  function createTestApp() {
    const app = new Hono();
    app.get('/test', zValidator('query', EmailQuerySchema, validationHook), (c) => {
      const { email } = c.req.valid('query') as { email: string };
      return c.json({ email }, 200);
    });
    return app;
  }

  it('passes valid query data through', async () => {
    const app = createTestApp();
    const res = await app.request('/test?email=user@example.com');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'user@example.com' });
  });

  it('returns 422 with code/detail for missing email', async () => {
    const app = createTestApp();
    const res = await app.request('/test');
    expect(res.status).toBe(422);
    const body = (await res.json()) as ProblemDetails;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.detail).toBe('The request contains invalid fields.');
    expect(body.status).toBe(422);
    expect(body.errors).toBeDefined();
    expect(body.errors![0]).toHaveProperty('path');
    expect(body.errors![0]).toHaveProperty('message');
  });

  it('returns 422 for invalid email format', async () => {
    const app = createTestApp();
    const res = await app.request('/test?email=not-an-email');
    expect(res.status).toBe(422);
    const body = (await res.json()) as ProblemDetails;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors![0].path).toBe('email');
  });
});

describe('validationHook unit tests', () => {
  it('returns void for successful validation', () => {
    const result = { success: true as const, data: { email: 'test@test.com' } };
    const c = {} as any;
    expect(validationHook(result, c)).toBeUndefined();
  });

  it('returns ProblemDetails on validation failure', () => {
    const result = {
      success: false as const,
      error: {
        issues: [{ path: ['email'], message: 'Invalid email' }],
      },
    };
    const c = {
      json: (body: ProblemDetails, status: number) => ({ body, status }),
    } as any;
    const response = validationHook(result, c) as any;
    expect(response).toBeDefined();
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.detail).toBe('The request contains invalid fields.');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toEqual({ path: 'email', message: 'Invalid email' });
  });

  it('converts nested paths to dot-separated strings', () => {
    const result = {
      success: false as const,
      error: {
        issues: [{ path: ['user', 'address', 'zip'], message: 'Too short' }],
      },
    };
    const c = {
      json: (body: ProblemDetails, status: number) => ({ body, status }),
    } as any;
    const response = validationHook(result, c) as any;
    expect(response.body.errors[0].path).toBe('user.address.zip');
  });

  it('handles numeric path segments', () => {
    const result = {
      success: false as const,
      error: {
        issues: [{ path: ['items', 0, 'name'], message: 'Required' }],
      },
    };
    const c = {
      json: (body: ProblemDetails, status: number) => ({ body, status }),
    } as any;
    const response = validationHook(result, c) as any;
    expect(response.body.errors[0].path).toBe('items.0.name');
  });

  it('reports multiple errors', () => {
    const result = {
      success: false as const,
      error: {
        issues: [
          { path: ['email'], message: 'Required' },
          { path: ['name'], message: 'Too short' },
          { path: ['age'], message: 'Expected number' },
        ],
      },
    };
    const c = {
      json: (body: ProblemDetails, status: number) => ({ body, status }),
    } as any;
    const response = validationHook(result, c) as any;
    expect(response.body.errors).toHaveLength(3);
  });
});

describe('ProblemDetails interface', () => {
  it('compiles with errors array', () => {
    const details: ProblemDetails = {
      code: 'VALIDATION_ERROR',
      detail: 'The request contains invalid fields.',
      status: 422,
      errors: [{ path: 'email', message: 'Invalid' }],
    };
    expect(details.code).toBe('VALIDATION_ERROR');
  });

  it('compiles without errors field', () => {
    const details: ProblemDetails = {
      code: 'MISCONFIG',
      detail: 'An unexpected error occurred',
      status: 500,
    };
    expect(details.errors).toBeUndefined();
  });

  it('compiles with empty errors', () => {
    const details: ProblemDetails = {
      code: 'VALIDATION_ERROR',
      detail: 'The request contains invalid fields.',
      status: 422,
      errors: [],
    };
    expect(details.errors).toEqual([]);
  });
});
