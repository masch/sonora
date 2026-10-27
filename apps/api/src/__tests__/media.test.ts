import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  REFERENCE_IMAGE_LIMITS,
  mapArchivePath,
  mapGlyphsPath,
  mapSpritePath,
  mapStyleKey,
} from '@sonora/shared';
import app, { setDbClient } from '../index';

const ADMIN_KEY = 'test-admin-key-123';
const AUTH = { Authorization: `Bearer ${ADMIN_KEY}` };

function bindings(
  put = vi.fn().mockResolvedValue(undefined),
  extraEnv: Record<string, unknown> = {},
) {
  return { ADMIN_API_KEY: ADMIN_KEY, PUBLIC_BUCKET: { put }, ...extraEnv } as never;
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

  it('stores the immutable cache policy in production', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'referencia.png', { type: 'image/png' });

    await app.request(
      '/media/reference-images',
      { method: 'POST', headers: AUTH, body: imageForm(file) },
      bindings(put, { ENVIRONMENT: 'production' }),
    );

    expect(put).toHaveBeenCalledTimes(1);
    const [, , options] = put.mock.calls[0] as [string, ArrayBuffer, { httpMetadata: unknown }];
    expect(options.httpMetadata).toMatchObject({
      cacheControl: 'public, max-age=31536000, immutable',
    });
  });

  it('stores the revalidating cache policy outside production', async () => {
    // A reference image is unguessable and never overwritten, but the policy is
    // the environment's, not the key's: one decision for the whole deployment.
    const put = vi.fn().mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'referencia.png', { type: 'image/png' });

    await app.request(
      '/media/reference-images',
      { method: 'POST', headers: AUTH, body: imageForm(file) },
      bindings(put, { ENVIRONMENT: 'staging' }),
    );

    expect(put).toHaveBeenCalledTimes(1);
    const [, , options] = put.mock.calls[0] as [string, ArrayBuffer, { httpMetadata: unknown }];
    expect(options.httpMetadata).toMatchObject({ cacheControl: 'no-cache' });
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

// ── GET /media/public/:key ────────────────────────────────

const PRODUCTION_ORIGIN = 'https://sonora-api.sonora-api.workers.dev';
const STAGING_ORIGIN = 'https://sonora-api-staging.sonora-api.workers.dev';

/**
 * The origin the committed style document names: `map-assets.invalid` is
 * reserved by RFC 2606 and resolves nowhere, so the repository copy names no
 * environment.
 */
const RESERVED_ORIGIN = 'https://map-assets.invalid';

/** The archive path the style's basemap must point at, whatever origin serves it. */
const BASEMAP_ARCHIVE_PATH = mapArchivePath();

/**
 * The published style as it really is: labels and icons on a third party, and a
 * basemap url that names **production** even when the object is served from
 * staging — defect 2 in L14.
 */
const PUBLISHED_STYLE = {
  version: 8,
  name: 'Sonora basemap',
  glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
  sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
  sources: {
    basemap: {
      type: 'vector',
      url: `pmtiles://${PRODUCTION_ORIGIN}${BASEMAP_ARCHIVE_PATH}`,
      attribution: '&copy; OpenStreetMap contributors',
    },
    references: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [{ id: 'background', type: 'background', paint: {} }],
};

interface StoredObject {
  bytes: Uint8Array;
  contentType?: string;
  cacheControl?: string;
  etag?: string;
}

function stored(text: string, overrides: Omit<StoredObject, 'bytes'> = {}): StoredObject {
  return { bytes: new TextEncoder().encode(text), ...overrides };
}

function storedJson(value: unknown, overrides: Omit<StoredObject, 'bytes'> = {}): StoredObject {
  return stored(JSON.stringify(value), { contentType: 'application/json', ...overrides });
}

/**
 * A public-bucket double whose `get` answers only for the keys it was given —
 * the same shape the Worker sees, including `arrayBuffer()`, which the style
 * rewrite needs and the byte streaming must not.
 */
function publicBucket(objects: Record<string, StoredObject | 'throws'>) {
  const gets: string[] = [];
  const bucket = {
    get: async (key: string) => {
      gets.push(key);
      const object = objects[key];
      if (object === undefined) return null;
      if (object === 'throws') throw new Error('R2 unavailable');

      const { bytes } = object;
      return {
        key,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        arrayBuffer: async () => bytes.slice().buffer,
        httpEtag: object.etag ?? '"stored-etag"',
        httpMetadata: { contentType: object.contentType, cacheControl: object.cacheControl },
      };
    },
  };

  return { bucket: bucket as never, gets };
}

function requestAt(origin: string, key: string, env: Record<string, unknown>) {
  return app.fetch(new Request(`${origin}/media/public/${key}`), env as never);
}

describe('GET /media/public/:key', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rewrites a published style document to the origin that served it', async () => {
    // The style must stop naming a third party (labels/icons) and must stop
    // naming production tiles: a staging client was handed a production archive.
    const { bucket, gets } = publicBucket({ [mapStyleKey()]: storedJson(PUBLISHED_STYLE) });

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), { PUBLIC_BUCKET: bucket });
    const body = (await res.json()) as typeof PUBLISHED_STYLE;

    expect(res.status).toBe(200);
    expect(gets).toEqual([mapStyleKey()]);
    expect(body.glyphs).toBe(`${STAGING_ORIGIN}${mapGlyphsPath()}`);
    expect(body.sprite).toBe(`${STAGING_ORIGIN}${mapSpritePath()}`);
    expect(body.sources.basemap.url).toBe(`pmtiles://${STAGING_ORIGIN}${BASEMAP_ARCHIVE_PATH}`);
    // Nothing else is touched: the document the client receives is still the
    // document the style author published.
    expect(body).toEqual({
      ...PUBLISHED_STYLE,
      glyphs: `${STAGING_ORIGIN}${mapGlyphsPath()}`,
      sprite: `${STAGING_ORIGIN}${mapSpritePath()}`,
      sources: {
        ...PUBLISHED_STYLE.sources,
        basemap: {
          ...PUBLISHED_STYLE.sources.basemap,
          url: `pmtiles://${STAGING_ORIGIN}${BASEMAP_ARCHIVE_PATH}`,
        },
      },
    });
  });

  it('serves the request origin for a style whose urls name the reserved one', async () => {
    // This is what makes normalising the committed document safe without
    // republishing anything: whatever origin the stored urls carry — even one
    // that does not exist — the client receives the origin that served this
    // request, so the committed values are placeholders and nothing more.
    const reserved = {
      ...PUBLISHED_STYLE,
      glyphs: `${RESERVED_ORIGIN}${mapGlyphsPath()}`,
      sprite: `${RESERVED_ORIGIN}${mapSpritePath()}`,
      sources: {
        ...PUBLISHED_STYLE.sources,
        basemap: {
          ...PUBLISHED_STYLE.sources.basemap,
          url: `pmtiles://${RESERVED_ORIGIN}${BASEMAP_ARCHIVE_PATH}`,
        },
      },
    };
    const { bucket } = publicBucket({ [mapStyleKey()]: storedJson(reserved) });

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), { PUBLIC_BUCKET: bucket });
    const body = (await res.json()) as typeof PUBLISHED_STYLE;

    expect(res.status).toBe(200);
    expect(body.glyphs).toBe(`${STAGING_ORIGIN}${mapGlyphsPath()}`);
    expect(body.sprite).toBe(`${STAGING_ORIGIN}${mapSpritePath()}`);
    // The `pmtiles://` source is re-pointed and keeps its path, so the reserved
    // origin does not survive into the response.
    expect(body.sources.basemap.url).toBe(`pmtiles://${STAGING_ORIGIN}${BASEMAP_ARCHIVE_PATH}`);
    expect(JSON.stringify(body)).not.toContain('map-assets.invalid');
  });

  it('keeps the immutable cache headers and the stored etag on the rewritten document', async () => {
    // The rewrite is deterministic per origin, so the stored etag still names
    // exactly one response body for a given url: a cache can keep it for a year.
    const { bucket } = publicBucket({ [mapStyleKey()]: storedJson(PUBLISHED_STYLE) });

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), { PUBLIC_BUCKET: bucket });

    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('etag')).toBe('"stored-etag"');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('streams a non-style object byte-for-byte, headers included', async () => {
    // An archive is opaque bytes: parsing it, or even re-encoding it, would
    // corrupt a range request the client already relies on.
    const archive = new Uint8Array([0x50, 0x4d, 0x54, 0x00, 0xff, 0xfe, 0x7b, 0x22]);
    const { bucket } = publicBucket({
      [mapArchivePath().replace('/media/public/', '')]: {
        bytes: archive,
        contentType: 'application/octet-stream',
        cacheControl: 'public, max-age=31536000, immutable',
        etag: '"archive-etag"',
      },
    });

    const res = await requestAt(STAGING_ORIGIN, mapArchivePath().replace('/media/public/', ''), {
      PUBLIC_BUCKET: bucket,
    });

    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(archive);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('etag')).toBe('"archive-etag"');
  });

  it('streams a style document of another version untouched', async () => {
    // Only the version in play is rewritten: an older published style stays the
    // bytes its author uploaded, so a rollback is a variable and not a rewrite.
    const otherStyle = storedJson(PUBLISHED_STYLE);
    const { bucket } = publicBucket({ 'styles/v2.json': otherStyle });

    const res = await requestAt(STAGING_ORIGIN, 'styles/v2.json', { PUBLIC_BUCKET: bucket });

    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(otherStyle.bytes);
  });

  it('rewrites the version the environment names instead of the compiled one', async () => {
    const { bucket, gets } = publicBucket({ 'styles/v7.json': storedJson(PUBLISHED_STYLE) });

    const res = await requestAt(STAGING_ORIGIN, 'styles/v7.json', {
      PUBLIC_BUCKET: bucket,
      MAP_ARTIFACT_VERSION: 'v7',
    });
    const body = (await res.json()) as typeof PUBLISHED_STYLE;

    expect(gets).toEqual(['styles/v7.json']);
    expect(body.glyphs).toBe(`${STAGING_ORIGIN}${mapGlyphsPath()}`);
  });

  it('serves a malformed style document as the raw bytes it already was', async () => {
    // A broken style must not become a 500: the client can still fall back to
    // whatever it parsed before, and the bug is reported in the log instead.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = stored('{ "version": 8, ', { contentType: 'application/json' });
    const { bucket } = publicBucket({ [mapStyleKey()]: raw });

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), { PUBLIC_BUCKET: bucket });

    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(raw.bytes);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[1])).toContain(mapStyleKey());
  });

  it('serves a style document with no version as the raw bytes it already was', async () => {
    // `version` is the one field MapLibre reads before anything else, so a
    // document without it is not a style and is not ours to rewrite.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = storedJson({ name: 'Sonora basemap', layers: [] });
    const { bucket } = publicBucket({ [mapStyleKey()]: raw });

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), { PUBLIC_BUCKET: bucket });

    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(raw.bytes);
    expect(warn).toHaveBeenCalled();
  });

  it('serves the revalidating policy outside production, over a stored immutable one', async () => {
    // The archive in staging is overwritten in place, without a version bump, so
    // the object's own `immutable` policy is exactly what would hide the new
    // bytes for a year: the served header must override it, not defer to it.
    const archive = new Uint8Array([0x50, 0x4d, 0x54, 0x00, 0xff]);
    const key = mapArchivePath().replace('/media/public/', '');
    const { bucket } = publicBucket({
      [key]: {
        bytes: archive,
        contentType: 'application/octet-stream',
        cacheControl: 'public, max-age=31536000, immutable',
        etag: '"archive-etag"',
      },
    });

    const res = await requestAt(STAGING_ORIGIN, key, {
      PUBLIC_BUCKET: bucket,
      ENVIRONMENT: 'staging',
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    // Only the cache policy changes: the bytes and the etag are the stored ones.
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(archive);
    expect(res.headers.get('etag')).toBe('"archive-etag"');
  });

  it('serves the revalidating policy on a rewritten style document outside production', async () => {
    const { bucket } = publicBucket({ [mapStyleKey()]: storedJson(PUBLISHED_STYLE) });

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), {
      PUBLIC_BUCKET: bucket,
      ENVIRONMENT: 'staging',
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('etag')).toBe('"stored-etag"');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('treats any environment that is not production as revalidating', async () => {
    const { bucket } = publicBucket({ [mapStyleKey()]: storedJson(PUBLISHED_STYLE) });

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), {
      PUBLIC_BUCKET: bucket,
      ENVIRONMENT: 'development',
    });

    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('keeps the immutable policy when the environment is explicitly production', async () => {
    const { bucket } = publicBucket({ [mapStyleKey()]: storedJson(PUBLISHED_STYLE) });

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), {
      PUBLIC_BUCKET: bucket,
      ENVIRONMENT: 'production',
    });

    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('answers 404 for a key the bucket does not hold', async () => {
    const { bucket } = publicBucket({});

    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), { PUBLIC_BUCKET: bucket });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('answers STORAGE_NOT_CONFIG when no public bucket is bound', async () => {
    const res = await requestAt(STAGING_ORIGIN, mapStyleKey(), {});

    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('STORAGE_NOT_CONFIG');
  });
});
