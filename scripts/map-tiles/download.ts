/**
 * scripts/map-tiles/download.ts — downloads that cannot lie.
 *
 * The spikes that priced this pipeline lost three downloads and one afternoon to the network:
 * three truncated files, and one mirror that stalled at 259 MB with the connection still open
 * for 9 h 46 min. `curl` and planetiler's own downloader resume a transfer and check the size
 * the server promised, but neither stops an attempt that stops delivering, and neither opens
 * the archive it just wrote. That is the gap this module closes, in four rules:
 *
 * 1. **Resume, but only the same version.** A partial lives in `<destination>.part` next to a
 *    `<destination>.part.meta` holding the validator it was fetched against, and a resume sends
 *    `Range` with `If-Range`. A changed file — or a part with no validator — starts over instead
 *    of gluing a new tail onto an old head.
 * 2. **Speed guard.** A transfer that delivers less than `minBytesPerSecond` over `windowMs`
 *    is aborted and retried, so a mirror that hangs without closing costs one window instead
 *    of an afternoon.
 * 3. **Size.** When the server publishes a total (`Content-Length`, `Content-Range`), the
 *    finished file has to have exactly that many bytes.
 * 4. **Integrity.** `verify` has to pass before the part is renamed into place, so a nine-byte
 *    `Not Found` is never a JAR and a truncated zip is never a source. The checks here read
 *    structure, not contents: a zip's central directory and a PBF's first blob are cheap to
 *    read on a 900 MB file, while a CRC of every member is not.
 *
 * Nothing here knows what a region is; it turns a URL into a file that can be trusted, or
 * says in one sentence why it could not.
 */
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Bytes per second a transfer has to keep up, averaged over the window. */
export const DEFAULT_MIN_BYTES_PER_SECOND = 64 * 1024;
/** How long the guard watches before it decides the transfer stalled. */
export const DEFAULT_WINDOW_MS = 30_000;
export const DEFAULT_ATTEMPTS = 3;

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR = Buffer.from([0x50, 0x4b, 0x06, 0x07]);
const ZIP_METADATA_LIMIT = 8 * 1024 * 1024;
const PBF_HEADER_LIMIT = 64 * 1024;

/** The slice of `fetch` this module needs, so a test can answer without a network. */
export interface FetchLike {
  (
    url: string,
    init: { headers: Record<string, string>; signal: AbortSignal },
  ): Promise<{
    status: number;
    headers: { get(name: string): string | null };
    body: ReadableStream<Uint8Array> | null;
  }>;
}

export interface DownloadOptions {
  url: string;
  /** Where the file belongs once it is complete and verified. */
  destination: string;
  /** One sentence when the finished file is unusable, `null` when it can be trusted. */
  verify?: (path: string) => string | null;
  minBytesPerSecond?: number;
  windowMs?: number;
  attempts?: number;
}

export interface DownloadResult {
  ok: boolean;
  /** Bytes in the file that ended up at `destination`. */
  bytes: number;
  /** Bytes that were already on disk and reused by the attempt that succeeded. */
  resumedFrom: number;
  /** How many requests it took; zero when the file was already there. */
  attempts: number;
  /** True when nothing was fetched because the file on disk already verified. */
  cached: boolean;
  /** One sentence for the operator when `ok` is false. */
  message?: string;
}

export interface DownloadDeps {
  fetch?: FetchLike;
  now?: () => number;
  log?: (line: string) => void;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sizeOfFile(path: string): number {
  try {
    const info = statSync(path);
    return info.isFile() ? info.size : 0;
  } catch {
    return 0;
  }
}

function readBytes(path: string, length: number, position: number): Buffer | null {
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    const buffer = Buffer.alloc(length);
    return readSync(fd, buffer, 0, length, position) === length ? buffer : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

/** `bytes 4-9/10` → `{ start: 4, total: 10 }`; `bytes 4-9/*` → `{ start: 4, total: null }`. */
export function parseContentRange(
  value: string | null,
): { start: number; total: number | null } | null {
  if (value === null) return null;
  const match = /^bytes\s+(\d+)-\d+\/(\d+|\*)$/.exec(value.trim());
  if (match === null) return null;
  const start = Number(match[1]);
  return { start, total: match[2] === '*' ? null : Number(match[2]) };
}

/** The total from a `416` answer, the only place the server says how big the file really is. */
export function parseUnsatisfiedRange(value: string | null): number | null {
  if (value === null) return null;
  const match = /^bytes\s+\*\/(\d+)$/.exec(value.trim());
  return match === null ? null : Number(match[1]);
}

/** What a partial file was fetched against: the validator, and the size the server declared. */
interface PartState {
  etag: string | null;
  total: number | null;
}

function readPartState(path: string): PartState | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed === null || typeof parsed !== 'object') return null;
    const record = parsed as { etag?: unknown; total?: unknown };
    const etag =
      typeof record.etag === 'string' && record.etag.trim().length > 0 ? record.etag.trim() : null;
    const total =
      typeof record.total === 'number' && Number.isInteger(record.total) && record.total > 0
        ? record.total
        : null;
    return { etag, total };
  } catch {
    return null;
  }
}

/**
 * The validator to resume against — a strong `ETag` or `Last-Modified`. A weak `ETag` is skipped:
 * HTTP forbids it as `If-Range`, and using it is how a changed file gets appended to.
 */
function validatorOf(headers: { get(name: string): string | null }): string | null {
  const etag = headers.get('etag')?.trim();
  if (etag !== undefined && etag.length > 0 && !etag.startsWith('W/')) return etag;
  const modified = headers.get('last-modified')?.trim();
  return modified !== undefined && modified.length > 0 ? modified : null;
}

/**
 * Downloads `url` to `destination`, resuming what is already in `<destination>.part`, stopping
 * an attempt that stops delivering, and refusing a file its integrity check rejects.
 *
 * The destination only ever appears complete: the part is renamed into place after the size and
 * the integrity check both pass, so a consumer either finds a usable file or finds nothing.
 */
export async function downloadVerified(
  options: DownloadOptions,
  deps: DownloadDeps = {},
): Promise<DownloadResult> {
  const doFetch: FetchLike = deps.fetch ?? ((url, init) => fetch(url, init));
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? (() => {});
  const verify = options.verify ?? (() => null);
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const minRate = options.minBytesPerSecond ?? DEFAULT_MIN_BYTES_PER_SECOND;
  const partPath = `${options.destination}.part`;
  const partStatePath = `${partPath}.meta`;

  // A file that is already there and verifies is a cache hit: no request, no HEAD, nothing.
  if (existsSync(options.destination)) {
    const problem = verify(options.destination);
    if (problem === null) {
      const bytes = sizeOfFile(options.destination);
      return { ok: true, bytes, resumedFrom: 0, attempts: 0, cached: true };
    }
    log(`discarding ${options.destination}: ${problem}`);
    unlinkSync(options.destination);
  }

  mkdirSync(dirname(options.destination), { recursive: true });

  let lastMessage = 'the download never ran';
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    attemptsUsed = attempt;
    let offset = sizeOfFile(partPath);
    let resumeState = offset > 0 ? readPartState(partStatePath) : null;

    // Without a validator the bytes on disk may be a different file: `-latest` is rewritten
    // upstream every day, so resuming blind could produce an extract that still passes verify.
    if (offset > 0 && (resumeState === null || resumeState.etag === null)) {
      log(
        `no validator for the partial ${partPath}: starting over instead of resuming (attempt ${attempt} of ${attempts})`,
      );
      unlinkSync(partPath);
      offset = 0;
      resumeState = null;
    }

    const headers: Record<string, string> = {};
    if (offset > 0 && resumeState !== null && resumeState.etag !== null) {
      headers['Range'] = `bytes=${offset}-`;
      headers['If-Range'] = resumeState.etag;
    }

    const controller = new AbortController();
    let response: Awaited<ReturnType<FetchLike>>;

    try {
      response = await doFetch(options.url, { headers, signal: controller.signal });
    } catch (error) {
      lastMessage = `requesting ${options.url} failed: ${reasonOf(error)}`;
      log(`${lastMessage} (attempt ${attempt} of ${attempts})`);
      continue;
    }

    if (response.status === 416) {
      // The answer says how big the file really is, so a part is promoted only when it is exactly
      // that big and verifies: a stale part from yesterday's `-latest` is a different size.
      const total = parseUnsatisfiedRange(response.headers.get('content-range'));
      if (offset > 0 && total !== null && offset === total) {
        const problem = verify(partPath);
        if (problem === null) {
          unlinkSync(partStatePath);
          renameSync(partPath, options.destination);
          return { ok: true, bytes: offset, resumedFrom: offset, attempts: attempt, cached: false };
        }
        lastMessage = problem;
      } else {
        lastMessage = `the server refused to resume at ${offset} bytes and says the file is ${total ?? 'of unknown size'} bytes`;
      }
      unlinkSync(partPath);
      unlinkSync(partStatePath);
      log(`${lastMessage} (attempt ${attempt} of ${attempts})`);
      continue;
    }

    if (response.status !== 200 && response.status !== 206) {
      lastMessage = `requesting ${options.url} answered ${response.status}`;
      log(`${lastMessage} (attempt ${attempt} of ${attempts})`);
      continue;
    }

    const contentRange = parseContentRange(response.headers.get('content-range'));
    const resumed = response.status === 206 && offset > 0;
    if (resumed && (contentRange === null || contentRange.start !== offset)) {
      lastMessage = `the server resumed at ${contentRange?.start ?? 'an unknown byte'} instead of ${offset}`;
      log(`${lastMessage}; starting over (attempt ${attempt} of ${attempts})`);
      unlinkSync(partPath);
      unlinkSync(partStatePath);
      continue;
    }
    if (
      resumed &&
      resumeState?.total != null &&
      contentRange?.total != null &&
      resumeState.total !== contentRange.total
    ) {
      // `If-Range` said the file is the one we started; a different total means it is not.
      lastMessage = `the file changed under the partial ${partPath}: ${resumeState.total} bytes then, ${contentRange.total} now`;
      log(`${lastMessage}; starting over (attempt ${attempt} of ${attempts})`);
      unlinkSync(partPath);
      unlinkSync(partStatePath);
      continue;
    }
    // A server that ignores the range answers 200 with the whole file: appending it would
    // duplicate the head, so the part is restarted instead.
    if (!resumed && offset > 0) {
      log(
        `the server ignored the range request; starting over (attempt ${attempt} of ${attempts})`,
      );
      offset = 0;
    }
    const total = resumed
      ? (contentRange?.total ?? null)
      : Number(response.headers.get('content-length')) || null;

    // The part records what it was started against, before the bytes arrive: an attempt killed
    // mid-stream has to leave enough behind for the next run to know whether resuming is safe.
    if (!resumed) {
      writeFileSync(partStatePath, JSON.stringify({ etag: validatorOf(response.headers), total }));
    }

    const reader = response.body?.getReader();
    if (reader === undefined || reader === null) {
      lastMessage = `requesting ${options.url} returned no body`;
      log(`${lastMessage} (attempt ${attempt} of ${attempts})`);
      continue;
    }

    const fd = openSync(partPath, resumed ? 'a' : 'w');
    let bytes = offset;
    let windowStart = now();
    let windowBytes = 0;
    let stalled = false;
    const guard = setInterval(
      () => {
        const elapsed = now() - windowStart;
        if (elapsed < windowMs) return;
        const rate = (windowBytes * 1000) / elapsed;
        windowStart = now();
        windowBytes = 0;
        if (rate < minRate) {
          stalled = true;
          controller.abort();
        }
      },
      Math.max(5, Math.floor(windowMs / 2)),
    );

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value === undefined) continue;
        writeSync(fd, value, 0, value.length);
        bytes += value.length;
        windowBytes += value.length;
      }
    } catch (error) {
      lastMessage = stalled
        ? `the transfer stalled at ${bytes} bytes: under ${minRate} bytes/s for ${windowMs} ms`
        : `the transfer failed at ${bytes} bytes: ${reasonOf(error)}`;
      log(`${lastMessage} (attempt ${attempt} of ${attempts})`);
      continue;
    } finally {
      clearInterval(guard);
      closeSync(fd);
    }

    if (total !== null && bytes !== total) {
      lastMessage = `the transfer stopped at ${bytes} of ${total} bytes`;
      log(`${lastMessage} (attempt ${attempt} of ${attempts})`);
      continue;
    }

    const problem = verify(partPath);
    if (problem !== null) {
      // Resuming a finished-but-wrong file cannot fix it: the nine-byte "Not Found" has no tail
      // to fetch. Throw it away so the next attempt starts from zero.
      unlinkSync(partPath);
      unlinkSync(partStatePath);
      lastMessage = problem;
      log(`${lastMessage} (attempt ${attempt} of ${attempts})`);
      continue;
    }

    unlinkSync(partStatePath);
    renameSync(partPath, options.destination);
    return { ok: true, bytes, resumedFrom: offset, attempts: attempt, cached: false };
  }

  return {
    ok: false,
    bytes: sizeOfFile(partPath),
    resumedFrom: 0,
    attempts: attemptsUsed,
    cached: false,
    message: `${lastMessage}; gave up after ${attemptsUsed} attempt${attemptsUsed === 1 ? '' : 's'} (the partial file stays at ${partPath})`,
  };
}

/** The end record of a zip, wherever its comment puts it. */
function readEndRecord(path: string, size: number): Buffer | null {
  if (size < 22) return null;
  const tailLength = Math.min(size, 22 + 0xffff);
  const tail = readBytes(path, tailLength, size - tailLength);
  if (tail === null) return null;
  for (let at = tail.length - 22; at >= 0; at -= 1) {
    if (tail.readUInt32LE(at) === ZIP_END_SIGNATURE) return tail.subarray(at);
  }
  return null;
}

/** Where a zip's central directory is, from the end record. */
function readCentralDirectory(
  path: string,
  size: number,
): { offset: number; length: number; entries: number } | null {
  const end = readEndRecord(path, size);
  if (end === null) return null;
  const entries = end.readUInt16LE(10);
  const length = end.readUInt32LE(12);
  const offset = end.readUInt32LE(16);
  return { offset, length, entries };
}

/**
 * One sentence when `path` is not a structurally complete zip, `null` when it is.
 *
 * This is what catches a truncated download and a nine-byte `Not Found`: both end without a
 * central directory, and neither can be mistaken for a source. Member CRCs are deliberately
 * not verified — reading 900 MB to prove what the end record already proves is not a trade
 * worth making on every build.
 */
export function zipProblem(path: string): string | null {
  const size = sizeOfFile(path);
  if (size === 0) return `${path} is not a zip: it is empty.`;

  const end = readEndRecord(path, size);
  if (end === null) {
    return `${path} ends without its central directory end record: the download is truncated, or it is not a zip at all.`;
  }

  const directory = readCentralDirectory(path, size);
  if (directory === null) return `${path} has an unreadable central directory.`;

  if (directory.entries === 0xffff || directory.offset === 0xffffffff) {
    // zip64 keeps the real numbers in a separate record; a truncated zip64 loses its locator
    // before it loses anything else, so finding the locator is the check that matters.
    const tail = readBytes(path, Math.min(size, 22 + 0xffff), Math.max(0, size - (22 + 0xffff)));
    if (tail === null || !tail.includes(ZIP64_LOCATOR)) {
      return `${path} claims zip64 but its locator is missing: the download is truncated.`;
    }
    return null;
  }

  if (directory.entries === 0)
    return `${path} holds no entries: the archive is empty or truncated.`;
  if (directory.offset + directory.length > size) {
    return `${path} points its central directory past the end of the file: the download is truncated.`;
  }
  const signature = readBytes(path, 4, directory.offset);
  if (signature === null || signature.readUInt32LE(0) !== ZIP_CENTRAL_SIGNATURE) {
    return `${path} has no central directory where its end record says it is: the download is truncated.`;
  }
  return null;
}

/** The member names of a zip, or `null` when its central directory cannot be read. */
export function zipEntryNames(path: string): string[] | null {
  const size = sizeOfFile(path);
  const directory = readCentralDirectory(path, size);
  if (directory === null) return null;

  const length = Math.min(directory.length, ZIP_METADATA_LIMIT);
  const bytes = directory.offset === 0xffffffff ? null : readBytes(path, length, directory.offset);
  if (bytes === null) return null;

  const names: string[] = [];
  let at = 0;
  while (at + 46 <= bytes.length) {
    if (bytes.readUInt32LE(at) !== ZIP_CENTRAL_SIGNATURE) break;
    const nameLength = bytes.readUInt16LE(at + 28);
    const extraLength = bytes.readUInt16LE(at + 30);
    const commentLength = bytes.readUInt16LE(at + 32);
    names.push(bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8'));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return names.length > 0 ? names : null;
}

/**
 * One sentence when `path` is not a JAR, `null` when it is.
 *
 * A nine-byte `Not Found` from the wrong repository was silently accepted as `planetiler.jar`
 * during the spike; a real JAR always carries a manifest, so not having one is the cheapest
 * honest reason to refuse running it.
 */
export function jarProblem(path: string): string | null {
  const zip = zipProblem(path);
  if (zip !== null) return zip;
  const names = zipEntryNames(path);
  if (names === null) return `${path} has no readable central directory, so it cannot be a JAR.`;
  if (!names.includes('META-INF/MANIFEST.MF')) {
    return `${path} is a zip without META-INF/MANIFEST.MF: it is not a JAR, so nothing here can run it.`;
  }
  return null;
}

/** One sentence when `path` does not start with an OSM PBF header, `null` when it does. */
export function osmPbfProblem(path: string): string | null {
  const size = sizeOfFile(path);
  if (size < 5) return `${path} is not an OSM PBF file: ${size} bytes cannot hold its header.`;

  const lengthBytes = readBytes(path, 4, 0);
  if (lengthBytes === null) return `${path} cannot be read.`;
  const headerLength = lengthBytes.readUInt32BE(0);
  if (headerLength === 0 || headerLength > PBF_HEADER_LIMIT || headerLength + 4 > size) {
    return `${path} is not an OSM PBF file: its first blob claims ${headerLength} bytes.`;
  }

  const header = readBytes(path, headerLength, 4);
  if (header === null || !header.includes('OSMHeader')) {
    return `${path} is not an OSM PBF file: its first blob is not an OSMHeader.`;
  }
  return null;
}

/**
 * The header every SQLite database starts with, which is what a GeoPackage is underneath.
 *
 * `daylight-landcover.gpkg` has no archive to open and no extension anyone can check: it is a
 * SQLite file, so the first 16 bytes either are this header or the file is not a GeoPackage.
 * That is the same read as the gzip check, and it is what tells a padded download from a real one.
 */
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'latin1');

/**
 * The slice of `bun:sqlite` this module uses.
 *
 * Declared here for the reason the `Bun` global is declared in `render-check.ts`: pulling
 * `@types/bun` into the whole `scripts/` typecheck for one class is not a trade worth making.
 * `bun:sqlite` ships with the runtime, so there is no dependency to add.
 */
interface GpkgDatabase {
  query(sql: string): { get(): Record<string, unknown> | null };
  close(): void;
}

const { Database: GpkgDatabaseClass } = require('bun:sqlite') as {
  Database: new (path: string, options?: { readonly?: boolean }) => GpkgDatabase;
};

/**
 * One sentence when `path` is not a GeoPackage SQLite can open, `null` when it is.
 *
 * The header is not enough, and this is not hypothetical: a transfer that dies at the end can be
 * padded to the length it promised, so the SQLite magic and the page count both look right while
 * the pages are zeros — tonight's `daylight-landcover.gpkg` failure mode, and the reason this
 * verifier exists. The length check catches a truncated file; only opening the database catches a
 * padded one, so `bun:sqlite` — built into the runtime — reads page one and the pages after it.
 *
 * `quick_check` is the cheap form of `integrity_check`: it walks the btree structures and says
 * `ok` without scanning every row, which is the right cost for a file the tiler reads next.
 *
 * A read-only connection to a WAL-mode database still creates `-shm` and `-wal` sidecars, and that
 * is not a detail: verifying the cache left an empty `daylight-landcover.gpkg-wal` behind, and the
 * build's own source check then refused the whole run for a file nobody downloaded. A verifier that
 * writes is not a verifier, so this one notes what is already there and removes what it added.
 *
 * The SQLite header is not the identity either: any healthy database has it, so a truncated download
 * that is a valid SQLite file would be kept as a cached GeoPackage and then fail inside the tiler,
 * far from the cause. `application_id` is the field GeoPackage sets to `"GPKG"`, and it is the one
 * fact that separates the file this verifier is about from every other SQLite database.
 */
/** The `application_id` every GeoPackage declares: the ASCII bytes `GPKG`. */
const GPKG_APPLICATION_ID = 0x47504b47;

export function gpkgProblem(path: string): string | null {
  const magic = readBytes(path, SQLITE_MAGIC.length, 0);
  if (magic === null || !magic.equals(SQLITE_MAGIC)) {
    return `${path} is not a GeoPackage: it does not start with the SQLite format 3 header.`;
  }

  const sidecars = ['-wal', '-shm'].map((suffix) => `${path}${suffix}`);
  const before = sidecars.map((sidecar) => existsSync(sidecar));

  let database: GpkgDatabase | undefined;
  try {
    database = new GpkgDatabaseClass(path, { readonly: true });
    const identity = database.query('PRAGMA application_id').get();
    const applicationId = identity === null ? -1 : Number(Object.values(identity)[0]);
    if (applicationId !== GPKG_APPLICATION_ID) {
      return (
        `${path} is not a GeoPackage: SQLite application_id is ${applicationId}, ` +
        `not the "GPKG" marker (${GPKG_APPLICATION_ID}).`
      );
    }
    const row = database.query('PRAGMA quick_check').get();
    const verdict = row === null ? 'no answer' : String(Object.values(row)[0]);
    if (verdict !== 'ok') {
      return `${path} is not a usable GeoPackage: SQLite reports "${verdict}".`;
    }
    return null;
  } catch (error) {
    return `${path} is not a usable GeoPackage: ${reasonOf(error)}`;
  } finally {
    database?.close();
    sidecars.forEach((sidecar, index) => {
      if (!before[index] && existsSync(sidecar)) unlinkSync(sidecar);
    });
  }
}

/** One sentence when `path` does not start like a gzip stream, `null` when it does. */
export function gzipProblem(path: string): string | null {
  const magic = readBytes(path, 2, 0);
  if (magic === null || magic[0] !== 0x1f || magic[1] !== 0x8b) {
    return `${path} is not a gzip file: it does not start with the gzip magic bytes.`;
  }
  return null;
}

/**
 * One sentence when `path` is not a gzip stream that decompresses to the end, `null` when it does.
 *
 * The magic check cannot tell a whole file from one cut after its first block — and neither can the
 * byte count, because a truncated transfer can keep the length the server announced. Only reading
 * the stream to its trailer says the payload survived, and the sources this guards (`qrank.csv.gz`)
 * are read straight by the tiler, so a corrupt one has to fail here rather than inside the build.
 *
 * It decompresses into memory, which is why it is not the check `sourcesProblems` runs on every
 * file: it belongs to the pre-seed script, once per source.
 */
export function gzipStreamProblem(path: string): string | null {
  const magic = gzipProblem(path);
  if (magic !== null) return magic;

  try {
    gunzipSync(readFileSync(path), { maxOutputLength: 4 * 1024 * 1024 * 1024 });
    return null;
  } catch (error) {
    return `${path} is not a complete gzip stream: ${reasonOf(error)}`;
  }
}

/** The check a source file gets, chosen so the cheap structural test is never skipped. */
function sourceProblem(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith('.zip')) return zipProblem(path);
  if (lower.endsWith('.pbf')) return osmPbfProblem(path);
  if (lower.endsWith('.gz')) return gzipProblem(path);
  // `daylight-landcover.gpkg` has no extension that states its format, so its own magic bytes
  // decide: a zip is checked as a zip, anything else only has to be non-empty.
  if (lower.endsWith('.gpkg') && readBytes(path, 2, 0)?.toString('latin1') === 'PK') {
    return zipProblem(path);
  }
  return sizeOfFile(path) === 0 ? `${path} is empty.` : null;
}

/**
 * Every artefact in a planetiler sources directory that cannot be used, as sentences.
 *
 * An empty list means every file opens; an empty directory is itself a problem, because a
 * download stage that reports success without writing anything is exactly the lie this
 * module exists to stop.
 */
export function sourcesProblems(directory: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [`${directory} does not exist: no source was downloaded.`];
  }
  if (entries.length === 0) {
    return [`${directory} is empty: no source was downloaded.`];
  }

  const problems: string[] = [];
  for (const entry of entries) {
    const problem = sourceProblem(join(directory, entry));
    if (problem !== null) problems.push(problem);
  }
  return problems;
}

export interface ProgressGuardOptions {
  /** What the command is producing; the guard stops it when this stops growing. */
  measure: () => number;
  /** Whether the command already finished on its own. */
  isDone: () => boolean;
  /** How long the output may stay the same size before the command is stopped. */
  stallMs: number;
  intervalMs: number;
  /** Stops the command. Called once, when `stalled` is returned. */
  onStall: () => void;
}

export interface GuardDeps {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Watches a command's output until it finishes or stops growing, then says which happened.
 *
 * This is the speed guard for downloads this module does not own: planetiler fetches its own
 * auxiliary sources, and its HTTP client waits forever on a connection that stays open without
 * delivering. Keeping the rule here — a size that does not grow for `stallMs` — makes it
 * testable with a clock instead of a mirror.
 */
export async function guardProgress(
  options: ProgressGuardOptions,
  deps: GuardDeps = {},
): Promise<'done' | 'stalled'> {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));

  let lastSize = options.measure();
  let lastGrowth = now();
  while (!options.isDone()) {
    await sleep(options.intervalMs);
    const size = options.measure();
    if (size > lastSize) {
      lastSize = size;
      lastGrowth = now();
      continue;
    }
    if (now() - lastGrowth >= options.stallMs) {
      options.onStall();
      return 'stalled';
    }
  }
  return 'done';
}
