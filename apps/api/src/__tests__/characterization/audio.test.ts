import { describe, it, expect, vi } from 'vitest';
import app from '../../index';

const mockR2Bucket = {
  put: vi.fn(async () => ({ key: 'test.mp3', size: 100 })),
  get: vi.fn(),
  head: vi.fn(),
};

describe('POST /audio/upload — characterization', () => {
  const env = {
    ADMIN_API_KEY: 'test-admin-key',
    PRIVATE_BUCKET: mockR2Bucket as unknown as R2Bucket,
  };

  it('captures 401 when Authorization missing', async () => {
    const res = await app.request('/audio/upload', { method: 'POST' }, env);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    expect(body).toHaveProperty('detail', 'Valid authentication is required.');
    expect(body).toHaveProperty('status', 401);
  });

  it('captures 401 when Authorization invalid', async () => {
    const res = await app.request(
      '/audio/upload',
      { method: 'POST', headers: { Authorization: 'Bearer invalid-key' } },
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    expect(body).toHaveProperty('detail', 'Valid authentication is required.');
    expect(body).toHaveProperty('status', 401);
  });

  it('captures 422 when file or key missing (zValidator fails)', async () => {
    const res = await app.request(
      '/audio/upload',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-admin-key' },
        body: new FormData(),
      },
      env,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
  });

  it('captures 201 for valid upload', async () => {
    const fd = new FormData();
    fd.append('key', 'experiences/test.mp3');
    fd.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }), 'test.mp3');
    const res = await app.request(
      '/audio/upload',
      { method: 'POST', headers: { Authorization: 'Bearer test-admin-key' }, body: fd },
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.key).toBe('experiences/test.mp3');
    expect(body.streamUrl).toContain('/audio/stream?key=experiences%2Ftest.mp3');
  });

  it('captures 500 when ADMIN_API_KEY missing', async () => {
    const res = await app.request(
      '/audio/upload',
      { method: 'POST', headers: { Authorization: 'Bearer test-admin-key' } },
      { PRIVATE_BUCKET: mockR2Bucket as unknown as R2Bucket },
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'MISCONFIG');
    expect(body).toHaveProperty('detail', 'An unexpected error occurred');
    expect(body).toHaveProperty('status', 500);
  });
});
