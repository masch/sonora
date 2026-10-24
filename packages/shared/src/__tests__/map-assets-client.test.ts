import { describe, expect, it } from 'vitest';

import { MapAssetClient, MapAssetError } from '../map/assets-client';

const GLYPH_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/Noto%20Sans%20Regular/0-255.pbf';

/** One request the fake transport saw, so a retry is visible as a second call. */
interface Call {
  url: string;
  method: string;
  range: string | null;
  /** The signal the client aborts the request with, so a stall can be observed. */
  signal: AbortSignal | null;
  /** The encoding the client asks for, so a wrong length cannot creep back in. */
  acceptEncoding: string | null;
}

/**
 * A fake `fetch` that answers from a handler, recording every call.
 *
 * No test in this file touches the network: the client takes the transport it is
 * given, which is the whole point of injecting it.
 */
function transport(handler: (call: Call, attempt: number) => Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      range: headers.range ?? null,
      signal: init?.signal ?? null,
      acceptEncoding: headers['accept-encoding'] ?? null,
    };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  return { fetch: fetchImpl, calls };
}

/** Bytes of a body, the shape `download` returns and `Response` accepts. */
function bytes(...values: number[]): Uint8Array<ArrayBuffer> {
  return new Uint8Array(values);
}

describe('MapAssetClient.download', () => {
  it('returns the bytes of a 200 body', async () => {
    const { fetch, calls } = transport(async () => new Response(bytes(0x1a, 0x02, 0x7f), {}));
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 1_000 });

    await expect(client.download(GLYPH_URL)).resolves.toEqual(bytes(0x1a, 0x02, 0x7f));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: GLYPH_URL, method: 'GET', range: null });
  });

  it('raises a typed error carrying the url and the status of a non-200', async () => {
    const { fetch } = transport(
      async () => new Response('object not found', { status: 404, headers: {} }),
    );
    const client = new MapAssetClient({ fetch, retries: 2, retryBackoffMs: 1, timeoutMs: 1_000 });

    const error: unknown = await client.download(GLYPH_URL).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MapAssetError);
    expect(error).toMatchObject({ kind: 'status', status: 404, url: GLYPH_URL });
    expect((error as Error).message).toContain('404');
  });

  it('retries a 503 and returns the body once the host answers', async () => {
    const { fetch, calls } = transport(async (_call, attempt) =>
      attempt === 0
        ? new Response('service unavailable', { status: 503 })
        : new Response(bytes(0x08), {}),
    );
    const client = new MapAssetClient({ fetch, retries: 2, retryBackoffMs: 1, timeoutMs: 1_000 });

    await expect(client.download(GLYPH_URL)).resolves.toEqual(bytes(0x08));
    expect(calls).toHaveLength(2);
  });

  it('retries a network error and gives up after the configured attempts', async () => {
    const { fetch, calls } = transport(async (_call, attempt) => {
      if (attempt < 2) throw new TypeError('the network is down');
      return new Response(bytes(0x01), {});
    });
    const client = new MapAssetClient({ fetch, retries: 2, retryBackoffMs: 1, timeoutMs: 1_000 });

    await expect(client.download(GLYPH_URL)).resolves.toEqual(bytes(0x01));
    expect(calls).toHaveLength(3);
  });

  it('times out a body that stalls after the headers arrive', async () => {
    // The host answers 200 and then stops sending: the headers resolve, the body never
    // does. The timer has to still be armed at that point, or the run hangs.
    const { fetch } = transport((call) =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/x-protobuf' }),
        arrayBuffer: () =>
          new Promise<ArrayBuffer>((_resolve, reject) => {
            const abort = () => {
              const error = new Error('the body was aborted');
              error.name = 'AbortError';
              reject(error);
            };
            if (call.signal?.aborted) abort();
            else call.signal?.addEventListener('abort', abort);
          }),
      } as unknown as Response),
    );
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 10 });

    const error: unknown = await client.download(GLYPH_URL).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MapAssetError);
    expect(error).toMatchObject({ kind: 'timeout', url: GLYPH_URL });
  });

  it('aborts a request that never answers', async () => {
    // The transport only ever settles when the signal fires, which is exactly the
    // read that hangs forever on a stalled connection.
    const { fetch } = transport(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          const abort = () => {
            const error = new Error('the request was aborted');
            error.name = 'AbortError';
            reject(error);
          };
          if (call.signal?.aborted) abort();
          else call.signal?.addEventListener('abort', abort);
        }),
    );
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 10 });

    const error: unknown = await client.download(GLYPH_URL).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(MapAssetError);
    expect(error).toMatchObject({ kind: 'timeout', url: GLYPH_URL });
  });

  it('rejects an empty body', async () => {
    const { fetch } = transport(async () => new Response(bytes(), {}));
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 1_000 });

    await expect(client.download(GLYPH_URL)).rejects.toMatchObject({ kind: 'body' });
  });

  it('rejects a body that is clearly not the asset', async () => {
    // A host that answers 200 with an error page is not a font range, and writing
    // those bytes to the assets directory would publish a file MapLibre cannot read.
    const { fetch } = transport(
      async () => new Response('<!doctype html><h1>Not found</h1>', { status: 200 }),
    );
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 1_000 });

    await expect(client.download(GLYPH_URL)).rejects.toMatchObject({ kind: 'body' });
  });
});

describe('MapAssetClient.probe', () => {
  it('reports the status, the content type and the length of a HEAD', async () => {
    const { fetch, calls } = transport(
      async () =>
        new Response(null, {
          status: 200,
          headers: { 'content-type': 'application/x-protobuf', 'content-length': '76044' },
        }),
    );
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 1_000 });

    await expect(client.probe(GLYPH_URL)).resolves.toEqual({
      ok: true,
      status: 200,
      contentType: 'application/x-protobuf',
      contentLength: 76_044,
    });
    expect(calls.map((call) => call.method)).toEqual(['HEAD']);
    // The length is the object's, not a gzip of it: a caller compares it with a file.
    expect(calls[0].acceptEncoding).toBe('identity');
  });

  it('reports a 404 instead of failing, so the caller can name what is missing', async () => {
    const { fetch } = transport(async () => new Response(null, { status: 404 }));
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 1_000 });

    await expect(client.probe(GLYPH_URL)).resolves.toEqual({
      ok: false,
      status: 404,
      contentType: null,
      contentLength: null,
    });
  });

  it('falls back to a ranged GET when HEAD is refused', async () => {
    // A host or a proxy that will not answer HEAD still answers one byte of the
    // body, and the total length comes from `Content-Range`.
    const { fetch, calls } = transport(async (call) =>
      call.method === 'HEAD'
        ? new Response(null, { status: 405 })
        : new Response(bytes(0x1a), {
            status: 206,
            headers: {
              'content-type': 'application/x-protobuf',
              'content-range': 'bytes 0-0/76044',
            },
          }),
    );
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 1_000 });

    await expect(client.probe(GLYPH_URL)).resolves.toEqual({
      ok: true,
      status: 206,
      contentType: 'application/x-protobuf',
      contentLength: 76_044,
    });
    expect(calls.map((call) => call.method)).toEqual(['HEAD', 'GET']);
    expect(calls[1].range).toBe('bytes=0-0');
    expect(calls[1].acceptEncoding).toBe('identity');
  });
});

describe('MapAssetClient.getJson', () => {
  it('returns the parsed document', async () => {
    const { fetch } = transport(
      async () =>
        new Response('{"version":8,"glyphs":"https://example/glyphs/{fontstack}/{range}.pbf"}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 1_000 });

    await expect(
      client.getJson<{ version: number }>('https://example/style.json'),
    ).resolves.toEqual({
      version: 8,
      glyphs: 'https://example/glyphs/{fontstack}/{range}.pbf',
    });
  });

  it('rejects a body that is not JSON', async () => {
    const { fetch } = transport(
      async () => new Response('<!doctype html><h1>Not found</h1>', { status: 200 }),
    );
    const client = new MapAssetClient({ fetch, retries: 0, timeoutMs: 1_000 });

    await expect(client.getJson('https://example/style.json')).rejects.toMatchObject({
      kind: 'body',
      url: 'https://example/style.json',
    });
  });
});
