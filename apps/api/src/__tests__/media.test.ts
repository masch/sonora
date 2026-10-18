import { afterEach, describe, expect, it, vi } from 'vitest';

import { REFERENCE_IMAGE_LIMITS } from '@sonora/shared';
import app, { setDbClient } from '../index';

const ADMIN_KEY = 'test-admin-key-123';
const AUTH = { Authorization: `Bearer ${ADMIN_KEY}` };

function bindings(put = vi.fn().mockResolvedValue(undefined)) {
  return { ADMIN_API_KEY: ADMIN_KEY, PUBLIC_BUCKET: { put } } as never;
}

function imageForm(file: File): FormData {
  const form = new FormData();
  form.append('file', file);
  return form;
}

describe('POST /media/reference-images', () => {
  afterEach(() => {
    setDbClient(null);
  });

  it('stores an accepted image and returns a same-origin public url', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'referencia.png', { type: 'image/png' });

    const res = await app.request(
      '/media/reference-images',
      { method: 'POST', headers: AUTH, body: imageForm(file) },
      bindings(put),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { key: string; url: string };
    expect(body.key).toMatch(/^map-references\/[0-9a-f-]+\.png$/);
    expect(body.url).toContain(`/media/public/${body.key}`);
    expect(new URL(body.url).origin).toBe(
      new URL('http://localhost/media/reference-images').origin,
    );
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('rejects a file whose type is not an allowed image', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'nota.txt', { type: 'text/plain' });

    const res = await app.request(
      '/media/reference-images',
      { method: 'POST', headers: AUTH, body: imageForm(file) },
      bindings(put),
    );

    expect(res.status).toBe(422);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects an image larger than the limit', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const oversized = new Uint8Array(REFERENCE_IMAGE_LIMITS.maxBytes + 1);
    const file = new File([oversized], 'enorme.png', { type: 'image/png' });

    const res = await app.request(
      '/media/reference-images',
      { method: 'POST', headers: AUTH, body: imageForm(file) },
      bindings(put),
    );

    expect(res.status).toBe(422);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects the upload without an admin session', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1])], 'referencia.png', { type: 'image/png' });

    const res = await app.request(
      '/media/reference-images',
      { method: 'POST', body: imageForm(file) },
      bindings(put),
    );

    expect(res.status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });
});
