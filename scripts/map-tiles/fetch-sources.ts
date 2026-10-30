/**
 * scripts/map-tiles/fetch-sources.ts — every source the tiler needs, fetched here first.
 *
 * A build already downloads what it needs, but planetiler fetches three of its own sources with a
 * client that does not resume and does not open what it wrote: a stalled mirror restarts
 * `qrank.csv.gz`, `daylight-landcover.gpkg` or `natural_earth_vector.gpkg.zip` from zero, and one
 * of those attempts left a file of exactly the promised `content-length` padded with zeros — a
 * file that looks complete and is garbage. Three failures in one night came from exactly that.
 *
 * `download.ts` already answers all of it: it resumes against the validator the partial was
 * fetched with, stops an attempt that stops delivering, checks the size the server promised, and
 * refuses a file its integrity check rejects. So this script is a table and a loop over it,
 * writing into the folder the tiler resolves its sources against
 * (`<cache>/planetiler/data/sources`). planetiler finds a file there and skips its own download,
 * which is why running this before a build turns "18 minutes of downloading, if it finishes" into
 * "planetiler downloads nothing".
 *
 * The table is deliberately complete: the region's extract, the two ~950 MB outline archives the
 * build already owns, and the three smaller files planetiler used to fetch itself.
 *
 * Usage:
 *   bun scripts/map-tiles/fetch-sources.ts [--region=calamuchita] [--cache=<dir>] [--only=<name,name>]
 *
 * Exit code 0 means every requested source is on disk and verified; 1 means at least one is not,
 * after the others were still attempted.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_MAP_REGION,
  MAP_REGIONS,
  isMapRegionKey,
} from '../../packages/shared/src/map/regions';
import { DEFAULT_CACHE_DIR, MAP_TILE_EXTRACTS } from './build';
import {
  type DownloadDeps,
  type DownloadOptions,
  type DownloadResult,
  type FetchLike,
  downloadVerified,
  gpkgProblem,
  gzipProblem,
  osmPbfProblem,
  zipProblem,
} from './download';

/**
 * Where planetiler keeps its inputs, relative to its working directory.
 *
 * Repeated from `build.ts` on purpose: those constants are private there, and this script must
 * resolve the same folder the build's `--osm-path` and the tiler's own downloader use, or a file
 * fetched here is a file downloaded again there.
 */
const TILER_DIR_NAME = 'planetiler';
const TILER_SOURCES_DIR = 'data/sources';

/** Geofabrik publishes one `-latest.osm.pbf` per extract, with a Content-Length. */
const GEOFABRIK_BASE = 'https://download.geofabrik.de';

/** One file the tiler reads, and the cheapest check that says whether it can be read. */
export interface TileSource {
  /** Stable name, and the file name planetiler looks for inside `data/sources`. */
  name: string;
  url: string;
  /** One sentence when the finished file is unusable, `null` when it can be trusted. */
  verify: (path: string) => string | null;
}

/**
 * Every source whose url is the same whichever region is being built.
 *
 * The first two are the archives the build already fetches; the other three are the ones
 * planetiler used to fetch itself, and the ones that cost whole runs. Their verifiers read
 * structure, not contents: a zip's central directory, a gzip's magic bytes, and the SQLite header
 * a GeoPackage starts with.
 */
export const MAP_TILE_SOURCES: readonly TileSource[] = [
  {
    name: 'water-polygons-split-3857.zip',
    url: 'https://osmdata.openstreetmap.de/download/water-polygons-split-3857.zip',
    verify: zipProblem,
  },
  {
    name: 'land-polygons-split-3857.zip',
    url: 'https://osmdata.openstreetmap.de/download/land-polygons-split-3857.zip',
    verify: zipProblem,
  },
  {
    name: 'qrank.csv.gz',
    url: 'https://qrank.toolforge.org/download/qrank.csv.gz',
    verify: gzipProblem,
  },
  {
    name: 'daylight-landcover.gpkg',
    url: 'https://r2-public.protomaps.com/datasets/daylight-landcover.gpkg',
    verify: gpkgProblem,
  },
  {
    name: 'natural_earth_vector.gpkg.zip',
    url: 'https://naciscdn.org/naturalearth/packages/natural_earth_vector.gpkg.zip',
    verify: zipProblem,
  },
];

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The region's Geofabrik area, or one sentence saying why nothing is fetched.
 *
 * Both refusals use the build's own words, because the build is the thing they protect: its
 * `MAP_TILE_EXTRACTS` is the only place that says what a region means, and a second opinion here
 * would let a typo fetch an extract of somewhere else and call it this region.
 */
function extractAreaOf(region: string, extracts: Record<string, string>): string {
  if (!isMapRegionKey(region)) {
    throw new Error(
      `unknown region "${region}": MAP_REGIONS declares ${Object.keys(MAP_REGIONS).join(', ')}, and the tiler bounds come from that declaration.`,
    );
  }
  const extract = extracts[region];
  if (typeof extract !== 'string' || extract.trim().length === 0) {
    throw new Error(
      `no Geofabrik extract for "${region}": MAP_TILE_EXTRACTS declares ${Object.keys(extracts).join(', ') || 'nothing'}, and without one the tiler would default to Monaco — a tileset of somewhere else.`,
    );
  }
  return extract.trim();
}

/**
 * The complete table for one region: the extract first, then the rest.
 *
 * The extract cannot sit in the static table because its url is the region; its file name is
 * derived the way the build derives `--osm-path`, so the file fetched here is the file the tiler
 * is handed.
 */
export function sourcesForRegion(
  region: string,
  extracts: Record<string, string> = MAP_TILE_EXTRACTS,
): TileSource[] {
  const area = extractAreaOf(region, extracts);
  return [
    {
      name: `${area.split('/').pop() ?? region}.osm.pbf`,
      url: `${GEOFABRIK_BASE}/${area}-latest.osm.pbf`,
      verify: osmPbfProblem,
    },
    ...MAP_TILE_SOURCES,
  ];
}

/** The folder the tiler resolves its sources against: `<cache>/planetiler/data/sources`. */
export function tilerSourcesDir(cacheDir: string): string {
  return resolve(cacheDir, TILER_DIR_NAME, TILER_SOURCES_DIR);
}

/** What one source needs from `downloadVerified`, destination included. */
export function sourceOptions(source: TileSource, cacheDir: string): DownloadOptions {
  return {
    url: source.url,
    destination: resolve(tilerSourcesDir(cacheDir), source.name),
    verify: source.verify,
  };
}

/** Only the sources `--only` names, or every one when it names none. */
export function selectSources(sources: TileSource[], only: readonly string[]): TileSource[] {
  if (only.length === 0) return [...sources];
  const known = sources.map((source) => source.name);
  const unknown = only.filter((name) => !known.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `unknown source ${unknown.map((name) => `"${name}"`).join(', ')}: this run knows ${known.join(', ')}.`,
    );
  }
  return sources.filter((source) => only.includes(source.name));
}

export interface FetchSourcesOptions {
  /** A key of `MAP_REGIONS`; decides the extract. */
  region: string;
  /** Directory that survives between runs: `<cache>/planetiler/data/sources` lives under it. */
  cacheDir: string;
  /** Source names to fetch; empty means every one. */
  only?: string[];
}

/** One line of output, and what it says about the file. */
export interface SourceOutcome {
  name: string;
  ok: boolean;
  line: string;
}

export interface FetchSourcesResult {
  /** True only when every requested source is on disk and verified. */
  ok: boolean;
  outcomes: SourceOutcome[];
}

export interface FetchSourcesDeps {
  /** Injected so a test can watch the loop without a network; defaults to `downloadVerified`. */
  download?: (options: DownloadOptions, deps?: DownloadDeps) => Promise<DownloadResult>;
  fetch?: FetchLike;
  log?: (line: string) => void;
}

function describeSuccess(source: TileSource, result: DownloadResult): string {
  if (result.cached) {
    return `${source.name}: cached (${result.bytes} bytes already on disk and verified)`;
  }
  return `${source.name}: ${result.bytes} bytes (${result.resumedFrom} reused from disk)`;
}

/**
 * Fetches every requested source, one at a time, and says one line about each.
 *
 * A source that fails does not stop the others: a mirror that is down for one file is usually
 * fine for the next, and the operator wants the whole list of what is missing, not the first
 * entry. Only a file that verifies is ever reported as fetched, so a green line is always true.
 */
export async function fetchSources(
  options: FetchSourcesOptions,
  deps: FetchSourcesDeps = {},
): Promise<FetchSourcesResult> {
  const download = deps.download ?? downloadVerified;
  const log = deps.log ?? ((line: string) => console.log(line));
  const sources = selectSources(sourcesForRegion(options.region), options.only ?? []);

  const outcomes: SourceOutcome[] = [];
  for (const source of sources) {
    let line: string;
    let ok: boolean;
    try {
      const result = await download(sourceOptions(source, options.cacheDir), {
        fetch: deps.fetch,
        log,
      });
      ok = result.ok;
      line = ok
        ? describeSuccess(source, result)
        : `${source.name}: FAILED: ${result.message ?? 'no reason given'}`;
    } catch (error) {
      // An injected downloader can throw where `downloadVerified` returns a sentence; either
      // way one source is one line, and the rest are still tried.
      ok = false;
      line = `${source.name}: FAILED: ${reasonOf(error)}`;
    }
    log(line);
    outcomes.push({ name: source.name, ok, line });
  }

  return { ok: outcomes.every((outcome) => outcome.ok), outcomes };
}

/** `--name=value` or `--name value`, the same shape the other map-tiles scripts use. */
function flag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const index = argv.indexOf(`--${name}`);
  if (inline === undefined && index === -1) return undefined;

  const value = inline !== undefined ? inline.slice(prefix.length) : (argv[index + 1] ?? '');
  // A blank value is not a small value: `resolve('')` is the process cwd, which is not a cache,
  // and an empty `--only=` would read as "everything" instead of as the mistake it is.
  if (value.trim().length === 0) {
    throw new Error(
      `--${name} needs a value, got "${value}": a blank one is not usable, so the run stops instead of guessing.`,
    );
  }
  return value;
}

/** Every flag `main` reads. A name outside this list is refused instead of ignored. */
const KNOWN_FLAGS = ['region', 'cache', 'only', 'help'];

export function assertKnownFlags(argv: string[]): void {
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2).split('=')[0] ?? '';
    if (KNOWN_FLAGS.includes(name)) continue;
    throw new Error(
      `unknown option --${name}; this script reads ${KNOWN_FLAGS.map((each) => `--${each}`).join(', ')}.`,
    );
  }
}

export interface FetchSourcesArgs {
  region: string;
  /** Absolute, so a run from anywhere writes to the same cache the build reads. */
  cacheDir: string;
  only: string[];
}

export function parseArgs(argv: string[]): FetchSourcesArgs {
  return {
    region: flag(argv, 'region') ?? DEFAULT_MAP_REGION,
    cacheDir: resolve(flag(argv, 'cache') ?? DEFAULT_CACHE_DIR),
    only: (flag(argv, 'only') ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  };
}

/** The usage text, with the table in it, so the two cannot drift apart. */
export function usage(): string {
  return [
    'Usage:',
    '  bun scripts/map-tiles/fetch-sources.ts [--region=calamuchita] [--cache=<dir>] [--only=<name,name>]',
    '',
    `Fetches every source the tiler needs into <cache>/${TILER_DIR_NAME}/${TILER_SOURCES_DIR}, resuming an`,
    'interrupted transfer and verifying each file before it is used. planetiler finds them there and',
    'skips its own download, so the build downloads nothing.',
    '',
    'Options:',
    `  --region  one of: ${Object.keys(MAP_REGIONS).join(', ')} (default ${DEFAULT_MAP_REGION}) — picks the extract`,
    `  --cache   directory that survives between runs (default: ${DEFAULT_CACHE_DIR})`,
    '  --only    comma-separated subset of the source names below',
    '  --help    print this and exit',
    '',
    `Sources for --region=${DEFAULT_MAP_REGION}:`,
    ...sourcesForRegion(DEFAULT_MAP_REGION).map(
      (source) => `  ${source.name}\n      ${source.url}`,
    ),
  ].join('\n');
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(usage());
    return 0;
  }

  let options: FetchSourcesArgs;
  try {
    assertKnownFlags(argv);
    options = parseArgs(argv);
  } catch (error) {
    console.error(`map-tiles-fetch-sources: ${reasonOf(error)}`);
    console.error('');
    console.error(usage());
    return 1;
  }

  try {
    const result = await fetchSources(options);
    if (result.ok) return 0;

    const missing = result.outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.name);
    console.error(
      `map-tiles-fetch-sources: ${missing.length} of ${result.outcomes.length} sources did not end up verified (${missing.join(', ')}); the build would fetch ${missing.length === 1 ? 'it' : 'them'} itself.`,
    );
    return 1;
  } catch (error) {
    // A refused region lands here: one sentence, no stack.
    console.error(`map-tiles-fetch-sources: ${reasonOf(error)}`);
    return 1;
  }
}

const invoked = process.argv[1];
if (invoked !== undefined && resolve(invoked) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
