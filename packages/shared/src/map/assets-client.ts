/**
 * The HTTP client the map-asset tooling talks to the network with.
 *
 * `scripts/map-assets.ts` runs in Bun and needs three things from the network: a
 * style document as JSON, an asset's bytes, and an honest answer about whether a
 * public url serves the object the style expects. All three share the same
 * requirements — a timeout so a stalled connection cannot hang a release, a small
 * bounded retry because a bucket behind a CDN answers 503 while it warms up, and an
 * error that says which url failed and how — so they live in one class instead of
 * three hand-rolled `fetch` calls in the script.
 *
 * The transport is injected, which is what keeps the tests off the network, and this
 * module imports nothing from Expo or react-native so it can be unit-tested in the
 * shared package. This is the only place `fetch` appears in the map-asset tooling.
 */

/** What went wrong, so a caller can decide without parsing a message. */
export type MapAssetErrorKind = 'network' | 'timeout' | 'status' | 'body';

/** A failed map-asset request, carrying the url it was made to and the status. */
export class MapAssetError extends Error {
  constructor(
    public readonly kind: MapAssetErrorKind,
    public readonly url: string,
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'MapAssetError';
  }
}

/** The transport, so a test can answer without a socket. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface MapAssetClientConfig {
  /** Transport to use; defaults to the platform `fetch`. */
  fetch?: FetchLike;
  /** How long one attempt may take before it is aborted. */
  timeoutMs?: number;
  /** How many extra attempts a network error or a 5xx earns. */
  retries?: number;
  /** Base delay of the backoff between attempts; it doubles per attempt. */
  retryBackoffMs?: number;
  /** Where a retried attempt is reported, if the caller wants to see them. */
  logWarning?: (message: string) => void;
}

/** What `probe` found at one url. */
export interface MapAssetProbe {
  /** The host answered with an object, i.e. 200 or a 206 to a ranged request. */
  ok: boolean;
  status: number;
  contentType: string | null;
  contentLength: number | null;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_BACKOFF_MS = 500;

/**
 * Statuses that mean "this host will not answer HEAD", not "this object is
 * missing": a CDN that refuses the verb still serves the bytes to a GET.
 */
const HEAD_REFUSED: ReadonlySet<number> = new Set([403, 405, 501]);

/** The PNG signature, so a body that is an error page cannot pass as a sheet. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** The extension of the url's last path segment, lowercased, query and hash dropped. */
function extensionOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  const tail = path.slice(path.lastIndexOf('/') + 1);
  const dot = tail.lastIndexOf('.');
  return dot === -1 ? '' : tail.slice(dot).toLowerCase();
}

/**
 * Whether a body is plausibly the asset its url names.
 *
 * Not a content-type check — the host decides that, and `verify` compares it — but a
 * guard against the classic failure of this tooling: a host answering 200 with an
 * HTML error page, whose bytes would be uploaded as a font range or a sprite and
 * would then be served to every client as an asset that cannot be parsed.
 */
function looksLikeAsset(url: string, bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;

  switch (extensionOf(url)) {
    case '.png':
      return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
    case '.json': {
      // A JSON sheet is an object; `[` is accepted too so a future fixture in list
      // form is not refused. An HTML error page starts with `<`.
      const first = bytes.find(
        (byte) => byte !== 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d,
      );
      return first === 0x7b || first === 0x5b;
    }
    default:
      // Protobuf is binary with no magic number, so the only thing that can be said
      // without a schema is that a text document is not one: `<` opens an HTML page.
      return bytes[0] !== 0x3c;
  }
}

/** A `Content-Length` as a number, or `null` when absent or unparsable. */
function lengthOf(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** The total length a `Content-Range: bytes 0-0/1234` names. */
function totalFromContentRange(value: string | null): number | null {
  if (value === null) return null;
  const match = value.match(/\/(\d+)\s*$/);
  return match ? lengthOf(match[1]) : null;
}

export class MapAssetClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryBackoffMs: number;
  private readonly logWarning: (message: string) => void;

  constructor(config: MapAssetClientConfig = {}) {
    this.fetchImpl = config.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.retryBackoffMs = config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    this.logWarning = config.logWarning ?? (() => {});
  }

  /**
   * Sends one request with a per-attempt timeout and a bounded retry.
   *
   * The response is returned as the host sent it, including a 4xx: a 404 is an
   * answer this tooling has to report, not an exception to swallow. Only a network
   * error, a timeout or a 5xx is retried, and the last of those three is what is
   * thrown once the attempts run out.
   */
  private async send(url: string, init: RequestInit): Promise<Response> {
    let failure: MapAssetError | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) await sleep(this.retryBackoffMs * 2 ** (attempt - 1));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
        if (response.status >= 500 && attempt < this.retries) {
          failure = new MapAssetError(
            'status',
            url,
            `request failed with status ${response.status}`,
            response.status,
          );
          this.logWarning(`${url} answered ${response.status}; retrying`);
          continue;
        }
        return response;
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        const reason = error instanceof Error ? error.message : String(error);
        failure = aborted
          ? new MapAssetError('timeout', url, `request timed out after ${this.timeoutMs} ms`, null)
          : new MapAssetError('network', url, `request failed: ${reason}`, null);
        if (attempt < this.retries) this.logWarning(`${failure.message}; retrying`);
      } finally {
        clearTimeout(timer);
      }
    }

    throw failure ?? new MapAssetError('network', url, 'request failed', null);
  }

  /** Reads a response body as text, turning a non-2xx into a `status` error. */
  private async readText(url: string, response: Response): Promise<string> {
    if (!response.ok) {
      throw new MapAssetError(
        'status',
        url,
        `request failed with status ${response.status}`,
        response.status,
      );
    }
    return response.text();
  }

  /**
   * Fetches a JSON document — a style, in practice — and fails when the body is not
   * JSON at all, which is how a host that answers 200 with an error page is caught.
   */
  async getJson<T = unknown>(url: string): Promise<T> {
    const response = await this.send(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const text = await this.readText(url, response);

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new MapAssetError(
        'body',
        url,
        `response body is not JSON (${text.length} characters received)`,
        response.status,
      );
    }
  }

  /**
   * Fetches an asset's bytes.
   *
   * Only a 200 is accepted: a redirect chain that ends somewhere else, a 206 or a
   * 304 would all hand back bytes that are not the whole object the key is supposed
   * to hold. An empty body and a body that is clearly not the asset are refused too,
   * because writing them would publish a file MapLibre cannot read.
   */
  async download(url: string): Promise<Uint8Array> {
    const response = await this.send(url, { method: 'GET' });
    if (response.status !== 200) {
      throw new MapAssetError(
        'status',
        url,
        `expected status 200, got ${response.status}`,
        response.status,
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new MapAssetError('body', url, 'response body is empty', response.status);
    }
    if (!looksLikeAsset(url, bytes)) {
      throw new MapAssetError(
        'body',
        url,
        'response body is not the asset the url names',
        response.status,
      );
    }
    return bytes;
  }

  /**
   * Asks a host what it serves at one url, without downloading the object.
   *
   * HEAD is the cheap question and the one some CDNs refuse, so a refusal (403, 405,
   * 501) is retried as a one-byte ranged GET and the total length is read from
   * `Content-Range`. A 404 is reported as a 404: that is the answer this tooling
   * exists to collect.
   *
   * Both requests ask for `identity` encoding on purpose. With the default encoding
   * the reported length is the length of the *transfer* — a gzip of a font range is
   * 46 KB where the range is 76 KB — and a caller comparing that against a file on
   * disk would decide about the wrong object.
   */
  async probe(url: string): Promise<MapAssetProbe> {
    const headers: Record<string, string> = { 'accept-encoding': 'identity' };
    const head = await this.send(url, { method: 'HEAD', headers });
    const headContentType = head.headers.get('content-type');
    if (head.status === 200) {
      return {
        ok: true,
        status: 200,
        contentType: headContentType,
        contentLength: lengthOf(head.headers.get('content-length')),
      };
    }
    if (!HEAD_REFUSED.has(head.status)) {
      return {
        ok: false,
        status: head.status,
        contentType: headContentType,
        contentLength: lengthOf(head.headers.get('content-length')),
      };
    }

    const ranged = await this.send(url, {
      method: 'GET',
      headers: { ...headers, range: 'bytes=0-0' },
    });
    const ok = ranged.status === 200 || ranged.status === 206;
    const total =
      ranged.status === 206
        ? totalFromContentRange(ranged.headers.get('content-range'))
        : lengthOf(ranged.headers.get('content-length'));

    // The body of the ranged request is one byte and is never used; dropping it keeps
    // the connection from holding a stream nobody reads.
    try {
      await ranged.arrayBuffer();
    } catch {
      // A body that cannot be read does not change what the headers already said.
    }

    return {
      ok,
      status: ranged.status,
      contentType: ranged.headers.get('content-type'),
      contentLength: total,
    };
  }
}
