/**
 * scripts/map-tiles/verify-published.ts — is staging serving the archive that was just built?
 *
 * The upload is not the proof. Three things can make a successful `wrangler r2 object put` reach
 * nobody, and all three look like success from the terminal that ran it:
 *
 * 1. `/config` derives every archive url from `MAP_ARTIFACT_VERSION`, so an archive uploaded under
 *    a key the Worker is not configured for is invisible — the app is still told the old one.
 * 2. The media route streams the stored bytes; a publish that landed on another key, or failed
 *    after the archive and before the style, leaves the object the client fetches unchanged.
 * 3. A device that already holds an archive of exactly this size treats it as current
 *    (`isArchiveCurrent` compares the advertised byte count, never the content), so an archive
 *    rebuilt with the same size is one the walker never downloads again.
 *
 * This script answers all three against the thing clients actually read — `/config` and the media
 * route — instead of against the bucket we think we wrote to.
 *
 * Usage:
 *   bun scripts/map-tiles/verify-published.ts --region=calamuchita --version=v1 \
 *     --archive=<cache>/out/calamuchita.pmtiles [--previous-bytes=<n>] [--api=<origin>]
 *   bun scripts/map-tiles/verify-published.ts --snapshot --region=calamuchita [--api=<origin>]
 *
 * `--snapshot` prints the byte count `/config` advertises for the region (nothing when the region
 * is not published), which is what `make map-tiles-publish-staging` reads before a build to compare
 * against the size it is about to publish.
 *
 * Exit code 0 means staging serves the built bytes from the version in play. 1 means at least one
 * of the three is false, and the line that says which. The network is the only dependency: nothing
 * here writes to the bucket, which is why it is safe to run as often as an operator likes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The origin whose `/config` and media route are the subject: staging is what this publishes to. */
export const DEFAULT_API_BASE = 'https://sonora-api-staging.sonora-api.workers.dev';

/** The archive a published region points clients at, as `/config` describes it. */
export interface CatalogEntry {
  archiveUrl: string;
  /** The size advertised to the client, or `null` when the payload names none. */
  archiveBytes: number | null;
  /** The version segment of `archiveUrl`, e.g. `v1`; `null` when the url is not one of ours. */
  version: string | null;
}

export interface VerifyInput {
  region: string;
  version: string;
  /** The archive this run built. Absolute, resolved by `main`. */
  archivePath: string;
  /** The size `/config` advertised before the build, when the caller read it. */
  previousBytes: number | null;
  apiBase: string;
}

export interface VerifyDeps {
  /** `GET <url>` parsed as JSON; throwing is how "the API did not answer" is reported. */
  fetchJson: (url: string) => Promise<unknown>;
  /** `GET <url>` as bytes, which is what a client's map loader does. */
  fetchBytes: (url: string) => Promise<Uint8Array>;
  /** `HEAD <url>`, answered with the status alone: no archive is downloaded to ask. */
  fetchStatus: (url: string) => Promise<number>;
  /** The built archive, read once so its size and digest describe the same bytes. */
  readArchive: (path: string) => Promise<Uint8Array>;
  log: (line: string) => void;
}

export interface VerifyResult {
  ok: boolean;
  /** Everything worth telling the operator, warnings included. */
  lines: string[];
  /** What is wrong; empty means staging serves what was built. */
  failures: string[];
}

const TILE_PATH = /\/tiles\/[^/]+\/([^/?]+)\.pmtiles(?:[?#]|$)/;

/** The version segment of a published archive url, or `null` when it is not one. */
export function tileVersionOf(url: string): string | null {
  return TILE_PATH.exec(url)?.[1] ?? null;
}

/**
 * The archive the catalog points clients at for one region.
 *
 * `null` covers both "this region is not in the catalog" and "the payload is not the shape this
 * build understands": neither is a state a publish can be checked against.
 */
export function catalogEntry(config: unknown, region: string): CatalogEntry | null {
  if (config === null || typeof config !== 'object') return null;
  const map = (config as Record<string, unknown>).map;
  if (map === null || typeof map !== 'object') return null;
  const regions = (map as Record<string, unknown>).regions;
  if (regions === null || typeof regions !== 'object') return null;

  const entry = (regions as Record<string, unknown>)[region];
  if (entry === null || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  const url = record.archiveUrl;
  if (typeof url !== 'string' || url.length === 0) return null;

  const bytes = record.archiveBytes;

  return {
    archiveUrl: url,
    archiveBytes: typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : null,
    version: tileVersionOf(url),
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Shorter than the digest on purpose: a mismatch is read by a human, and the whole one is printed. */
function shortDigest(digest: string): string {
  return digest.slice(0, 12);
}

async function publishedConfig(apiBase: string, deps: VerifyDeps): Promise<unknown> {
  return deps.fetchJson(`${apiBase}/config`);
}

/**
 * The byte count `/config` advertises for the region, as text: a number, or nothing at all when
 * the region is not published. Printing nothing is what lets the caller pass it straight through.
 */
export async function readSnapshot(
  input: Pick<VerifyInput, 'region' | 'apiBase'>,
  deps: VerifyDeps,
): Promise<string> {
  const entry = catalogEntry(await publishedConfig(input.apiBase, deps), input.region);
  const bytes = entry?.archiveBytes;
  return typeof bytes === 'number' ? String(bytes) : '';
}

/** What the create-only guard needs: the keys one version would take. */
export interface AssertFreeInput {
  region: string;
  version: string;
  apiBase: string;
}

/**
 * Refuses a version whose keys are already taken, before anything is built or uploaded.
 *
 * A published version is immutable by policy: the url is the identity a client keys its
 * downloaded archive by, so rewriting one object under the same name is how devices end up
 * drawing bytes nobody published. This is the check that makes the policy real, and it runs
 * against the same media route a client reads: `404` is a free key, `200` is a version
 * somebody already published.
 *
 * It is deliberately a check before the write and not an atomic precondition — `wrangler r2
 * object put` has no create-only mode — so it refuses the case that actually happens (an
 * operator re-running a publish with the version still in the config) and leaves a
 * simultaneous second publish of the same version to the operator's discipline.
 */
export async function assertFree(input: AssertFreeInput, deps: VerifyDeps): Promise<VerifyResult> {
  const lines: string[] = [];
  const failures: string[] = [];

  for (const key of [
    `tiles/${input.region}/${input.version}.pmtiles`,
    `styles/${input.version}.json`,
  ]) {
    const status = await deps.fetchStatus(`${input.apiBase}/media/public/${key}`);

    if (status === 404) {
      lines.push(`  free: ${key}`);
      continue;
    }

    if (status === 200) {
      failures.push(
        `${key} is already published in this environment: a version is written once and never rewritten, so this run would republish over the artifact devices are keyed to. Bump MAP_ARTIFACT_VERSION to a version nobody has published and deploy before publishing.`,
      );
      continue;
    }

    // Anything else — a 500, a redirect to a login page — says nothing about the key, and
    // assuming it is free is how a guard turns into a silent overwrite.
    failures.push(
      `the check for ${key} answered ${status}: the key cannot be shown to be free, so nothing is uploaded.`,
    );
  }

  return { ok: failures.length === 0, lines, failures };
}

/**
 * Compare what was built against what a client is told, and against what it receives.
 *
 * Every failure names the thing to change: the version variable, the upload, or a new key. Never
 * a stack trace, because the operator reads this at the end of a five-minute build.
 */
export async function runVerify(input: VerifyInput, deps: VerifyDeps): Promise<VerifyResult> {
  const lines: string[] = [];
  const failures: string[] = [];

  const built = await deps.readArchive(input.archivePath);
  const builtDigest = sha256(built);
  lines.push(`${input.region} ${input.version}: built ${built.length} bytes`);
  lines.push(`  sha256 ${builtDigest}`);

  const entry = catalogEntry(await publishedConfig(input.apiBase, deps), input.region);

  if (entry === null) {
    failures.push(
      `"${input.region}" is not published: /config carries no archive for it, so no client can reach what this run uploaded.`,
    );
    return { ok: false, lines, failures };
  }

  if (entry.version !== input.version) {
    failures.push(
      `/config points clients at ${entry.version ?? 'a url with no version'}, and this run published ${input.version}: set MAP_ARTIFACT_VERSION=${input.version} (apps/api/wrangler.staging.toml) and deploy, or publish ${entry.version ?? 'that version'} instead.`,
    );
  }

  // The size is what a device compares to decide whether the archive it holds is still
  // the published one, so a payload that advertises another number — or none — makes a
  // byte-perfect upload unreachable in silence.
  if (entry.archiveBytes === null) {
    failures.push(
      `/config publishes ${input.region} without a byte count, and a device decides whether its archive is current by comparing that number: it cannot tell this one from the one it already holds.`,
    );
  } else if (entry.archiveBytes !== built.length) {
    failures.push(
      `/config advertises ${entry.archiveBytes} bytes for ${input.region} while the built archive is ${built.length}: a device compares that number, so it would keep the archive it already holds (or fetch again on every mount).`,
    );
  }

  const served = await deps.fetchBytes(entry.archiveUrl);
  const servedDigest = sha256(served);
  lines.push(`  served ${served.length} bytes by ${entry.archiveUrl}`);
  lines.push(`  sha256 ${servedDigest}`);

  if (servedDigest !== builtDigest) {
    failures.push(
      `what staging serves is not what was built: sha256 ${shortDigest(servedDigest)} served, ${shortDigest(builtDigest)} built (${served.length} vs ${built.length} bytes).`,
    );
  }

  if (input.previousBytes !== null && input.previousBytes === built.length) {
    lines.push(
      `  note: the archive has the same size (${built.length} bytes) as the one devices already hold.`,
    );
    lines.push(
      '        A device treats an archive of the same size as current and keeps it, so a walker that',
    );
    lines.push(
      '        already downloaded this region will not fetch again: publish a new VERSION to reach them.',
    );
  }

  return { ok: failures.length === 0, lines, failures };
}

/** The production dependencies: the network, the filesystem, and stdout. */
export function createDeps(log: (line: string) => void = (line) => console.log(line)): VerifyDeps {
  return {
    fetchJson: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url} answered ${response.status}`);
      return response.json();
    },
    fetchBytes: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url} answered ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
    fetchStatus: async (url) => (await fetch(url, { method: 'HEAD' })).status,
    readArchive: async (path) => new Uint8Array(readFileSync(path)),
    log,
  };
}

const USAGE = [
  'Usage:',
  '  bun scripts/map-tiles/verify-published.ts --region=calamuchita --version=v1 \\',
  '    --archive=<cache>/out/calamuchita.pmtiles [--previous-bytes=<n>] [--api=<origin>]',
  '  bun scripts/map-tiles/verify-published.ts --snapshot --region=calamuchita [--api=<origin>]',
  '  bun scripts/map-tiles/verify-published.ts --assert-free --region=calamuchita --version=v2 [--api=<origin>]',
].join('\n');

/** `--name=value` or `--name value`, the same shape the other scripts use. */
function flag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const index = argv.indexOf(`--${name}`);
  if (inline === undefined && index === -1) return undefined;
  const value = inline !== undefined ? inline.slice(prefix.length) : (argv[index + 1] ?? '');
  return value.trim().length === 0 ? undefined : value;
}

async function main(argv: string[]): Promise<number> {
  const deps = createDeps();
  const apiBase = flag(argv, 'api') ?? DEFAULT_API_BASE;
  const region = flag(argv, 'region');
  if (region === undefined) {
    console.error(`map-tiles-verify-published: --region is required.\n\n${USAGE}`);
    return 1;
  }

  if (argv.includes('--snapshot')) {
    process.stdout.write(await readSnapshot({ region, apiBase }, deps));
    return 0;
  }

  if (argv.includes('--assert-free')) {
    const version = flag(argv, 'version');
    if (version === undefined) {
      console.error(`map-tiles-verify-published: --version is required.\n\n${USAGE}`);
      return 1;
    }
    const free = await assertFree({ region, version, apiBase }, deps);
    for (const line of free.lines) deps.log(line);
    for (const failure of free.failures) console.error(`  failed: ${failure}`);
    if (free.ok) deps.log(`  ok: ${region} ${version} is unpublished in this environment`);
    return free.ok ? 0 : 1;
  }

  const version = flag(argv, 'version');
  const archive = flag(argv, 'archive');
  if (version === undefined || archive === undefined) {
    console.error(`map-tiles-verify-published: --version and --archive are required.\n\n${USAGE}`);
    return 1;
  }

  const previous = flag(argv, 'previous-bytes');
  const previousBytes = previous === undefined ? null : Number(previous);
  if (previousBytes !== null && !Number.isFinite(previousBytes)) {
    console.error('map-tiles-verify-published: --previous-bytes must be a byte count.');
    return 1;
  }

  const result = await runVerify(
    { region, version, archivePath: resolve(archive), previousBytes, apiBase },
    deps,
  );

  for (const line of result.lines) deps.log(line);
  for (const failure of result.failures) console.error(`  failed: ${failure}`);
  if (result.ok) deps.log(`  ok: ${region} ${version} is served, byte for byte`);

  return result.ok ? 0 : 1;
}

const invoked = process.argv[1];
if (invoked !== undefined && resolve(invoked) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(
        `map-tiles-verify-published: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    });
}
