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
