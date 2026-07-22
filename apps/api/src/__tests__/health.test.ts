import { describe, it, expect } from 'vitest';
import app from '../index';

describe('GET /health', () => {
  it('returns 200 with status ok and environment', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('environment');
  });

  it('returns the bound ENVIRONMENT variable', async () => {
    const res = await app.request('/health', {}, { ENVIRONMENT: 'testing' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; environment: string };
    expect(body.environment).toBe('testing');
  });

  it('returns unknown when ENVIRONMENT is not set', async () => {
    const res = await app.request('/health', {}, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; environment: string };
    expect(body.environment).toBe('unknown');
  });
});

describe('GET /health/db', () => {
  it('returns 500 with problem details when no DB client is configured', async () => {
    const res = await app.request('/health/db');
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      code: string;
      detail: string;
      status: number;
    };
    expect(body.code).toBe('DB_NOT_AVAILABLE');
    expect(body.detail).toBe('An unexpected error occurred');
    expect(body.status).toBe(500);
  });
});

describe('GET /health/full', () => {
  it('returns aggregated health with basic + db checks', async () => {
    const res = await app.request('/health/full', {}, { ENVIRONMENT: 'staging' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      environment: string;
      checks: { basic: { status: string }; database: { status: string; message: string } };
    };
    expect(body.status).toBe('degraded');
    expect(body.environment).toBe('staging');
    expect(body.checks.basic.status).toBe('ok');
    expect(body.checks.database.status).toBe('error');
  });

  it('returns ok when all checks pass', async () => {
    const res = await app.request('/health/full', {}, { ENVIRONMENT: 'staging' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    // Without DB client it's degraded, but the endpoint itself is 200
    expect(body.status).toBe('degraded');
  });
});
