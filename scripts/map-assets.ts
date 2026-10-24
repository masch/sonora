/**
 * scripts/map-assets.ts — Fetches and verifies the map assets a style names.
 *
 * The published style points `glyphs` and `sprite` at our own media paths
 * (`/media/public/glyphs/{fontstack}/{range}.pbf` and `/media/public/sprites/light`),
 * so the bucket has to hold the files behind them or every label and every icon is a
 * 404. The bytes are Protomaps' own assets, and the set is whatever the style asks
 * for, so this script reads the style and moves exactly that set.
 *
 * Usage:
 *   bun scripts/map-assets.ts fetch  --style=<url|path> [--out=map-assets] [--force]
 *   bun scripts/map-assets.ts verify --style=<url|path> [--origin=<url>]
 *
 * `fetch` writes the files into the bucket layout under `--out` (gitignored by
 * default) and uploads nothing; the `api-upload-map-assets-*` targets do that, so a
 * human decides when the bucket changes.
 *
 * `verify` probes the public urls the style would request and exits non-zero, naming
 * exactly what has to be uploaded. Today that is every object, because the bucket is
 * empty — which is what it is for.
 *
 * This is event-driven, not periodic: re-run `fetch` when the style names a new font
 * stack, when `GLYPH_RANGES` widens, when Protomaps publishes a new revision (bump
 * `MAP_ASSET_SOURCE_VERSION` in `packages/shared/src/map/glyphs.ts`) or for a fresh
 * bucket.
 *
 * Everything about *which* files exist and *where* they live comes from
 * `@sonora/shared`, so the app, the upload targets and this script cannot disagree
 * about the layout. `@sonora/shared` is not linked into the repository root, which is
 * why the two modules are imported by path instead of by package name.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import { MapAssetClient } from '../packages/shared/src/map/assets-client';
import {
  assetKeysForStyle,
  type MapAssetRequest,
  type StyleAssets,
} from '../packages/shared/src/map/glyphs';

/** Where `fetch` writes when `--out` is not given; gitignored. */
const DEFAULT_OUT = 'map-assets';

const USAGE = [
  'Usage:',
  '  bun scripts/map-assets.ts fetch  --style=<url|path> [--out=map-assets] [--force]',
  '  bun scripts/map-assets.ts verify --style=<url|path> [--origin=<url>]',
].join('\n');

interface FetchArgs {
  command: 'fetch';
  style: string;
  out: string;
  force: boolean;
}

interface VerifyArgs {
  command: 'verify';
  style: string;
  origin?: string;
}

type Args = FetchArgs | VerifyArgs;

function parseArgs(argv: string[]): Args {
  const command = argv[0];
  const get = (name: string): string | undefined => {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (inline !== undefined) return inline.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };

  if (command !== 'fetch' && command !== 'verify') {
    throw new Error(
      command === undefined
        ? 'no command given'
        : `unknown command "${command}", expected "fetch" or "verify"`,
    );
  }

  const style = get('style');
  if (style === undefined || style.length === 0) {
    throw new Error(`${command} needs --style=<url|path>`);
  }

  if (command === 'fetch') {
    return {
      command,
      style,
      out: get('out') ?? DEFAULT_OUT,
      force: argv.includes('--force'),
    };
  }

  return { command, style, origin: get('origin') };
}

/** Whether the style argument is a url instead of a path on disk. */
function isRemote(style: string): boolean {
  return /^https?:\/\//i.test(style);
}

/** A style document, read through the client when it is a url and from disk otherwise. */
async function loadStyle(style: string, client: MapAssetClient): Promise<StyleAssets> {
  if (isRemote(style)) {
    const document = await client.getJson<StyleAssets>(style);
    if (document === null || typeof document !== 'object') {
      throw new Error(`${style} did not answer with a style document`);
    }
    return document;
  }

  const path = resolve(style);
  const text = await readFile(path, 'utf8');
  try {
    return JSON.parse(text) as StyleAssets;
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

/** The size of a file, or `null` when there is no file at that path. */
async function sizeOf(path: string): Promise<number | null> {
  try {
    const info = await stat(path);
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

/**
 * The path an asset is written to, refusing anything that would leave `--out`.
 *
 * The keys are built from the style's own font stack names, so a malformed style
 * could otherwise name `../../elsewhere`. Writing outside the output directory is
 * not something this script may do, whatever the document says.
 */
function destinationFor(out: string, key: string): string {
  const destination = resolve(out, key);
  if (!destination.startsWith(`${resolve(out)}${sep}`)) {
    throw new Error(`refusing to write outside the output directory: ${key}`);
  }
  return destination;
}

/** Whether a served content type is the one the object has to carry. */
function matchesContentType(served: string | null, expected: string): boolean {
  if (served === null) return false;
  return served.split(';')[0].trim().toLowerCase() === expected.trim().toLowerCase();
}

/** Bytes as an exact count, which is what a comparison and a total need. */
function formatBytes(bytes: number): string {
  return `${bytes} bytes`;
}

async function fetchAssets(args: FetchArgs, client: MapAssetClient): Promise<number> {
  const document = await loadStyle(args.style, client);
  const requests = assetKeysForStyle(document);
  const out = resolve(args.out);

  if (requests.length === 0) {
    console.log(`${args.style} names no glyphs and no sprite: nothing to fetch.`);
    return 0;
  }

  console.log(`Fetching ${requests.length} map assets named by ${args.style}`);
  console.log(`  into ${out}`);
  console.log('');

  const width = Math.max(...requests.map((request) => request.key.length));
  const failures: string[] = [];
  let total = 0;

  for (const request of requests) {
    try {
      const destination = destinationFor(out, request.key);
      const present = await sizeOf(destination);

      // The upstream assets are immutable per revision, so a file already there with
      // the same size is the same object. `--force` is for a damaged copy.
      if (!args.force && present !== null) {
        const source = await client.probe(request.downloadUrl);
        if (source.contentLength === present) {
          total += present;
          console.log(`  ${request.key.padEnd(width)}  ${formatBytes(present)}  (already present)`);
          continue;
        }
      }

      const bytes = await client.download(request.downloadUrl);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
      total += bytes.length;
      console.log(`  ${request.key.padEnd(width)}  ${formatBytes(bytes.length)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${request.key}: ${message}`);
      console.log(`  ${request.key.padEnd(width)}  FAILED  ${message}`);
    }
  }

  console.log('');
  console.log(`Total: ${requests.length - failures.length} files, ${formatBytes(total)}`);

  if (failures.length > 0) {
    console.error('');
    console.error(`${failures.length} asset(s) could not be fetched:`);
    for (const failure of failures) console.error(`  ${failure}`);
    return 1;
  }

  console.log('');
  console.log('Upload them with one of:');
  console.log(`  make api-upload-map-assets-staging MAP_ASSETS_DIR=${out}`);
  console.log(`  make api-upload-map-assets-production MAP_ASSETS_DIR=${out}`);
  return 0;
}

async function verifyAssets(args: VerifyArgs, client: MapAssetClient): Promise<number> {
  const document = await loadStyle(args.style, client);
  const requests = assetKeysForStyle(
    document,
    args.origin === undefined ? {} : { origin: args.origin },
  );

  if (requests.length === 0) {
    console.log(`${args.style} names no glyphs and no sprite: nothing to verify.`);
    return 0;
  }

  const origin = args.origin === undefined ? 'the origin the style names' : args.origin;
  console.log(`Verifying ${requests.length} public map asset urls (${origin})`);
  console.log('');

  const width = Math.max(...requests.map((request) => request.key.length));
  const missing: MapAssetRequest[] = [];
  const problems: string[] = [];

  for (const request of requests) {
    try {
      const probe = await client.probe(request.url);
      const contentTypeOk = matchesContentType(probe.contentType, request.contentType);
      const ok = probe.ok && contentTypeOk;
      if (!ok) {
        missing.push(request);
        if (probe.ok) {
          problems.push(
            `${request.key}: served as ${probe.contentType ?? '(no content type)'}, expected ${request.contentType}`,
          );
        }
      }

      const status = `HTTP ${probe.status}`;
      const type = probe.contentType ?? '(no content type)';
      console.log(
        `  ${ok ? 'OK  ' : 'MISS'}  ${request.key.padEnd(width)}  ${status.padEnd(9)}  ${type}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      missing.push(request);
      problems.push(`${request.key}: ${message}`);
      console.log(`  ERR   ${request.key.padEnd(width)}  ${message}`);
    }
  }

  console.log('');

  if (missing.length === 0) {
    console.log(`All ${requests.length} objects are published with the expected content type.`);
    return 0;
  }

  console.error(
    `${missing.length} of ${requests.length} objects are not published as the style needs them.`,
  );
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  console.error('Upload exactly these keys:');
  for (const request of missing) {
    console.error(`  ${request.key}  (${request.contentType})`);
  }
  console.error('');
  console.error('  make map-assets-fetch STYLE_URL=<the style this run read>');
  console.error('  make api-upload-map-assets-staging MAP_ASSETS_DIR=map-assets');
  return 1;
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const client = new MapAssetClient({ logWarning: (message) => console.warn(`  ! ${message}`) });

  return args.command === 'fetch' ? fetchAssets(args, client) : verifyAssets(args, client);
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`map-assets: ${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    console.error(USAGE);
    process.exitCode = 1;
  });
