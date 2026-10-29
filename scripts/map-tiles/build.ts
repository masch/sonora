/**
 * scripts/map-tiles/build.ts — one entry point: a region in, a published-shaped archive out.
 *
 * `make map-tiles-build REGION=calamuchita` calls this script with `--region`, an optional
 * `--maxzoom` (default 16, the deepest zoom the forked profile emits) and an optional
 * `--cache` directory. Everything else is decided here, in three layers:
 *
 * 1. `planBuild` — pure apart from the injected readers and the extract table, so the pin, the
 *    patch list and the region's source are arguments instead of surprises. It returns the
 *    ordered steps the run will take: read the pin, check out the pinned commit (or reuse a
 *    checkout already at it), return the tree to that commit, apply every patch in filename
 *    order, build the profile jar, download the region's extract, download and verify the
 *    tiler's auxiliary sources, run the tiler, report. It throws a readable error for a region
 *    `MAP_REGIONS` does not declare, a region with no Geofabrik extract, an unreadable pin, a
 *    pin without a commit, a patches directory with no patches, and a maxzoom the profile
 *    cannot emit — before an operator spends four minutes and 1.4 GB finding out.
 * 2. `runBuild` — the thin layer: one injected executor, one step at a time, and the first
 *    non-zero exit ends the run with the step that failed. There is no `cd … && …` anywhere,
 *    so no prefix can fail silently and no `set -euo pipefail` pasted by hand is the thing
 *    standing between a half-patched profile and a compiled one.
 * 3. `main` — argv and exit codes, nothing else.
 *
 * Two defects the review of the fork (T1) found in the prose recipe are closed by
 * construction here: patch paths handed to `git -C` are absolute (git resolves a relative
 * one against `-C`, not against this process), and the checkout is reused when it already
 * sits at the pinned commit, so a re-run does not re-clone what is already there.
 *
 * Reuse needs a third guarantee, because a run leaves its applied patches in the work tree as
 * uncommitted changes: the step after the checkout returns that tree to the pinned commit. The
 * invariant is that **patches are always applied to a tree that is exactly the pinned commit**,
 * whether it was just cloned or reused. That is also why moving a reused checkout to a new pin
 * only fetches: `git checkout` refuses to move HEAD over the previous run's changes — exactly
 * when upstream touched a file the patches modify — and the reset step is what moves it.
 *
 * Usage:
 *   bun scripts/map-tiles/build.ts --region=calamuchita [--maxzoom=16] [--cache=<dir>]
 *
 * The cache directory holds the checkout and the ~1.4 GB of auxiliary sources the tiler
 * downloads, so it is printed at the start of a run: it is the thing worth keeping.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
  MAP_REGIONS,
  bboxTuple,
  isMapRegionKey,
  type MapRegionKey,
} from '../../packages/shared/src/map/regions';
import {
  type DownloadOptions,
  type DownloadResult,
  downloadVerified,
  guardProgress,
  jarProblem,
  osmPbfProblem,
  sourcesProblems,
} from './download';

/** The shallowest zoom the profile emits; planetiler's own floor for this profile. */
export const PROFILE_MIN_ZOOM = 0;

/**
 * The deepest zoom the forked profile emits. Patch 0002 takes buildings there and patch
 * 0003 takes pois there; asking for more would produce an archive that silently stops at 16
 * while claiming a deeper one, which is worse than refusing.
 */
export const PROFILE_MAX_ZOOM = 16;

export const DEFAULT_MAXZOOM = PROFILE_MAX_ZOOM;

/** Where a run keeps its checkout and the auxiliary sources when `--cache` is not given. */
export const DEFAULT_CACHE_DIR = join(tmpdir(), 'sonora-map-tiles');

const UPSTREAM_FILE = 'scripts/map-tiles/upstream.json';
const PATCHES_DIR = 'scripts/map-tiles/patches';
const CHECKOUT_DIR_NAME = 'basemaps';
const OUTPUT_DIR_NAME = 'out';
/** The tiler's own working directory: planetiler resolves its sources relative to it. */
const TILER_DIR_NAME = 'planetiler';
/** Where planetiler keeps its input files, relative to its working directory. */
const TILER_SOURCES_DIR = 'data/sources';
const JAR_SUFFIX = '-with-deps.jar';
const TILER_HEAP = '-Xmx8g';

/** How long a source download may deliver nothing before the attempt is stopped. */
export const SOURCE_STALL_MS = 120_000;
const SOURCE_STALL_INTERVAL_MS = 5_000;
const SOURCE_DOWNLOAD_ATTEMPTS = 3;

/** Geofabrik publishes one `-latest.osm.pbf` per extract, with a Content-Length. */
const GEOFABRIK_BASE = 'https://download.geofabrik.de';

/**
 * The Geofabrik extract each region is cut from.
 *
 * This table is not a convenience. The profile's own `--area` default is **monaco**, so a run
 * that names no extract downloads Monaco and tiles an empty box over Argentina — which is what
 * the first version of this script did, silently. A region without an entry here cannot be
 * planned at all.
 */
export const MAP_TILE_EXTRACTS: Record<MapRegionKey, string> = {
  calamuchita: 'south-america/argentina',
};

const USAGE = [
  'Usage:',
  '  bun scripts/map-tiles/build.ts --region=calamuchita [--maxzoom=16] [--cache=<dir>]',
  '',
  'Options:',
  `  --region   one of: ${Object.keys(MAP_REGIONS).join(', ')} (required)`,
  `  --maxzoom  deepest zoom to emit, ${PROFILE_MIN_ZOOM}-${PROFILE_MAX_ZOOM} (default ${DEFAULT_MAXZOOM})`,
  '  --cache    directory that survives between runs (default: a directory under the OS temp)',
].join('\n');

/** Everything a run needs to know, and nothing it could discover later without a surprise. */
export interface BuildOptions {
  /** A key of `MAP_REGIONS`. */
  region: string;
  /** Deepest zoom to emit; the tiler gets it verbatim. */
  maxzoom: number;
  /** Directory whose contents are worth keeping: checkout, auxiliary sources, output. */
  cacheDir: string;
  /** Where the pinned upstream is cloned; under `cacheDir` when `main` decides it. */
  workDir: string;
  /** Repository root, absolute from `main`; patch paths are derived from it, never from cwd. */
  repoRoot: string;
}

/** A process to run. `cwd` is always absolute, and the run never changes its own cwd. */
export interface Command {
  file: string;
  args: string[];
  cwd: string;
}

/** The upstream pin, read once so every later step agrees on the commit. */
export interface UpstreamPin {
  repository: string;
  commit: string;
  module: string;
}

/**
 * One thing the run does. Every step is executed by the same injected executor, which is
 * what makes "stop at the first failure" a property of the loop instead of a shell flag.
 */
export type BuildStep =
  | { kind: 'read-pin'; label: string; repository: string; commit: string }
  | { kind: 'sync-upstream'; label: string; repository: string; commit: string; dir: string }
  | {
      kind: 'reset-checkout';
      label: string;
      commit: string;
      dir: string;
      /** Run in order; together they make the tree exactly `commit` again. */
      commands: Command[];
    }
  | { kind: 'apply-patch'; label: string; patch: string; command: Command }
  | { kind: 'build-jar'; label: string; command: Command; targetDir: string }
  | {
      kind: 'fetch-osm';
      label: string;
      url: string;
      /** Where the extract belongs once it is complete and verified. */
      destination: string;
    }
  | {
      kind: 'download-sources';
      label: string;
      /** The tiler's working directory: its sources land under it, outside the checkout. */
      cwd: string;
      jarDir: string;
      args: string[];
    }
  | {
      kind: 'verify-sources';
      label: string;
      /** The directory whose every artefact has to open before the tiler reads it. */
      sourcesDir: string;
      osmPath: string;
    }
  | {
      kind: 'run-tiler';
      label: string;
      bounds: string;
      maxzoom: number;
      output: string;
      osmPath: string;
      cwd: string;
      jarDir: string;
    }
  | { kind: 'report'; label: string; output: string };

/** The plan: what will run, where it writes, and what it is pinned to. */
export interface BuildPlan {
  region: MapRegionKey;
  /** `w,s,e,n`, the region's declared box, already in the order planetiler expects. */
  bounds: string;
  maxzoom: number;
  cacheDir: string;
  workDir: string;
  output: string;
  /** The tiler's working directory; its `data/sources` lives here, not in the checkout. */
  sourcesDir: string;
  /** The region's Geofabrik extract, once downloaded and verified. */
  osmPath: string;
  extractUrl: string;
  repository: string;
  commit: string;
  module: string;
  /** Patch file names in the order they are applied. */
  patches: string[];
  steps: BuildStep[];
}

/** The reads and the table planning needs, injected so a test never touches the disk. */
export interface PlanDeps {
  /** Returns the text of `upstream.json`; throwing is how "unreadable" is reported. */
  readFile: (path: string) => string;
  /** Returns the entries of the patches directory; throwing is how "missing" is reported. */
  listDir: (path: string) => string[];
  /** Region → Geofabrik extract; defaults to `MAP_TILE_EXTRACTS`. */
  extracts?: Record<string, string>;
}

const defaultPlanDeps: PlanDeps = {
  readFile: (path) => readFileSync(path, 'utf8'),
  listDir: (path) => readdirSync(path),
  extracts: MAP_TILE_EXTRACTS,
};

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireRegion(region: string): MapRegionKey {
  if (!isMapRegionKey(region)) {
    throw new Error(
      `unknown region "${region}": MAP_REGIONS declares ${Object.keys(MAP_REGIONS).join(', ')}, and the tiler bounds come from that declaration.`,
    );
  }
  return region;
}

function requireMaxzoom(maxzoom: number): number {
  if (!Number.isInteger(maxzoom)) {
    throw new Error(`maxzoom must be a whole number, got ${String(maxzoom)}.`);
  }
  if (maxzoom < PROFILE_MIN_ZOOM || maxzoom > PROFILE_MAX_ZOOM) {
    throw new Error(
      `maxzoom ${maxzoom} is outside what the profile can emit: the patches stop at z${PROFILE_MAX_ZOOM}, so the range is ${PROFILE_MIN_ZOOM}-${PROFILE_MAX_ZOOM}.`,
    );
  }
  return maxzoom;
}

/**
 * The Geofabrik extract of a region, or a sentence saying the region cannot be built.
 *
 * Refusing here is the whole point of the table: planetiler's `--area` default is "monaco", so
 * a missing entry would otherwise produce a tileset of somewhere else and call it a build.
 */
function requireExtract(region: MapRegionKey, extracts: Record<string, string>): string {
  const extract = extracts[region];
  if (typeof extract !== 'string' || extract.trim().length === 0) {
    throw new Error(
      `no Geofabrik extract for "${region}": MAP_TILE_EXTRACTS declares ${Object.keys(extracts).join(', ') || 'nothing'}, and without one the tiler would default to Monaco — a tileset of somewhere else.`,
    );
  }
  return extract.trim();
}

/** Reads the pin, or throws one sentence about the file instead of a parse error. */
function readPin(upstreamPath: string, readFile: (path: string) => string): UpstreamPin {
  let text: string;
  try {
    text = readFile(upstreamPath);
  } catch (error) {
    throw new Error(`cannot read the pinned upstream at ${upstreamPath}: ${reasonOf(error)}`);
  }

  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`${upstreamPath} is not valid JSON: ${reasonOf(error)}`);
  }
  if (document === null || typeof document !== 'object') {
    throw new Error(`${upstreamPath} has no commit: it is not an object with a commit field.`);
  }

  const record = document as Record<string, unknown>;
  const commit = record.commit;
  if (typeof commit !== 'string' || commit.trim().length === 0) {
    throw new Error(`${upstreamPath} has no commit: the profile would not be pinned to anything.`);
  }
  const repository = record.repository;
  if (typeof repository !== 'string' || repository.trim().length === 0) {
    throw new Error(`${upstreamPath} has no repository: there is nothing to clone.`);
  }
  const module = record.module;

  return {
    repository: repository.trim(),
    commit: commit.trim(),
    module: typeof module === 'string' && module.trim().length > 0 ? module.trim() : 'tiles',
  };
}

/** The patches in filename order, or one sentence saying why there are none to apply. */
function readPatches(patchesDir: string, listDir: (path: string) => string[]): string[] {
  let entries: string[];
  try {
    entries = listDir(patchesDir);
  } catch (error) {
    throw new Error(`cannot read the patches directory ${patchesDir}: ${reasonOf(error)}`);
  }

  const patches = entries.filter((name) => name.endsWith('.patch')).sort();
  if (patches.length === 0) {
    throw new Error(
      `the patches directory is empty: ${patchesDir} holds no .patch files, so this run would build the upstream profile without our edits.`,
    );
  }
  return patches;
}

/**
 * The ordered steps for one region, and nothing executed yet.
 *
 * Pure apart from the two injected reads: given the same pin, patch list and options it
 * always returns the same plan, which is what lets the tests state the order as data.
 */
export function planBuild(options: BuildOptions, deps: Partial<PlanDeps> = {}): BuildPlan {
  const io: PlanDeps = {
    readFile: deps.readFile ?? defaultPlanDeps.readFile,
    listDir: deps.listDir ?? defaultPlanDeps.listDir,
    extracts: deps.extracts ?? defaultPlanDeps.extracts,
  };

  const repoRoot = resolve(options.repoRoot);
  const region = requireRegion(options.region);
  const maxzoom = requireMaxzoom(options.maxzoom);

  const upstreamPath = join(repoRoot, UPSTREAM_FILE);
  const pin = readPin(upstreamPath, io.readFile);
  const patchesDir = join(repoRoot, PATCHES_DIR);
  const patches = readPatches(patchesDir, io.listDir);
  const extract = requireExtract(region, io.extracts ?? {});

  const box = bboxTuple(MAP_REGIONS[region].bbox);
  if (box === null) {
    throw new Error(
      `region "${region}" declares an unusable bbox "${MAP_REGIONS[region].bbox}": expected w,s,e,n with w<e and s<n.`,
    );
  }
  // planetiler wants `--bounds=minlon,minlat,maxlon,maxlat`, which is exactly `bboxTuple`'s
  // order, so the box is never retyped: the one declared in MAP_REGIONS reaches the tiler.
  const bounds = box.join(',');

  const workDir = resolve(options.workDir);
  const cacheDir = resolve(options.cacheDir);
  const output = join(cacheDir, OUTPUT_DIR_NAME, `${region}.pmtiles`);
  // The tiler resolves its sources against its own working directory, which is this one: the
  // checkout's `reset-checkout` step runs `clean -fdx` and would delete anything kept inside it.
  const sourcesDir = join(cacheDir, TILER_DIR_NAME);
  const dataSourcesDir = join(sourcesDir, TILER_SOURCES_DIR);
  const extractUrl = `${GEOFABRIK_BASE}/${extract}-latest.osm.pbf`;
  const osmPath = join(dataSourcesDir, `${extract.split('/').pop() ?? region}.osm.pbf`);
  const moduleDir = join(workDir, pin.module);
  const targetDir = join(moduleDir, 'target');
  const commitShort = pin.commit.slice(0, 7);

  const steps: BuildStep[] = [
    {
      kind: 'read-pin',
      label: `read the pin (${pin.repository} at ${commitShort})`,
      repository: pin.repository,
      commit: pin.commit,
    },
    {
      kind: 'sync-upstream',
      label: `check out ${commitShort} in ${workDir}`,
      repository: pin.repository,
      commit: pin.commit,
      dir: workDir,
    },
    {
      // Patches are always applied to a tree exactly at the pin: a reused checkout still carries
      // the previous run's patches, and `git apply` stops on the first one it finds applied.
      // Unconditional because the plan is pure; on a fresh clone both commands are no-ops.
      // The sources survive because the tiler runs in `<cache>/planetiler`, a sibling of this
      // checkout, so a clean inside it cannot reach them.
      kind: 'reset-checkout',
      label: `reset ${workDir} to ${commitShort}`,
      commit: pin.commit,
      dir: workDir,
      commands: [
        { file: 'git', args: ['-C', workDir, 'reset', '--hard', pin.commit], cwd: workDir },
        { file: 'git', args: ['-C', workDir, 'clean', '-fdx'], cwd: workDir },
      ],
    },
    ...patches.map((name): BuildStep => ({
      kind: 'apply-patch',
      label: `apply ${name}`,
      patch: join(patchesDir, name),
      // `git -C <workDir> apply` resolves the patch path against `<workDir>`, so the patch
      // has to be absolute: a relative one fails even though the file is right there.
      command: {
        file: 'git',
        args: ['-C', workDir, 'apply', join(patchesDir, name)],
        cwd: workDir,
      },
    })),
    {
      kind: 'build-jar',
      label: 'build the profile jar',
      command: {
        file: 'mvn',
        args: ['-B', '-q', 'clean', 'package', '-DskipTests'],
        cwd: moduleDir,
      },
      targetDir,
    },
    {
      // The extract is fetched by us, not by planetiler: our downloader resumes it, stops an
      // attempt that stops delivering, and opens the file before the tiler reads it.
      kind: 'fetch-osm',
      label: `download the ${extract} extract`,
      url: extractUrl,
      destination: osmPath,
    },
    {
      // planetiler fetches its own auxiliary sources (water and land polygons, Natural Earth,
      // the landcover file, qrank, fonts) into the same directory. It retries chunks and checks
      // the promised size, but its client waits forever on a connection that stays open without
      // delivering, so each attempt runs under the stall guard and is retried.
      kind: 'download-sources',
      label: `download the tiler's sources into ${sourcesDir}`,
      cwd: sourcesDir,
      jarDir: targetDir,
      args: [
        `--bounds=${bounds}`,
        `--maxzoom=${maxzoom}`,
        `--osm-path=${osmPath}`,
        '--download',
        '--only-download',
      ],
    },
    {
      // Nothing planetiler downloaded is read before this passes: a truncated zip or a nine-byte
      // "Not Found" saved as a jar ends the run here instead of inside the tiler.
      kind: 'verify-sources',
      label: `verify every source in ${dataSourcesDir}`,
      sourcesDir: dataSourcesDir,
      osmPath,
    },
    {
      kind: 'run-tiler',
      label: `tile ${region} at z${maxzoom}`,
      bounds,
      maxzoom,
      output,
      osmPath,
      cwd: sourcesDir,
      jarDir: targetDir,
    },
    { kind: 'report', label: 'report the archive', output },
  ];

  return {
    region,
    bounds,
    maxzoom,
    cacheDir,
    workDir,
    output,
    sourcesDir,
    osmPath,
    extractUrl,
    repository: pin.repository,
    commit: pin.commit,
    module: pin.module,
    patches,
    steps,
  };
}

/** The flags the tiler receives, derived once so the box is never typed twice. */
export function tilerArgs(
  step: Pick<BuildStep & { kind: 'run-tiler' }, 'bounds' | 'maxzoom' | 'output' | 'osmPath'>,
): string[] {
  return [
    `--bounds=${step.bounds}`,
    `--maxzoom=${step.maxzoom}`,
    `--output=${step.output}`,
    // Named explicitly: the profile's own default is the `monaco` extract, so a run without this
    // would tile Monaco and report it as this region's archive.
    `--osm-path=${step.osmPath}`,
    // Re-running must replace the archive instead of failing on an existing one, and the
    // auxiliary sources have to be allowed to land in the cache directory.
    '--force',
    '--download',
  ];
}

/** The layers our three patches enrich, and the patch that should have added each one. */
const ENRICHED_LAYERS = [
  { layer: 'landuse', patch: '0001-landuse-keeps-its-name' },
  { layer: 'buildings', patch: '0002-buildings-name-and-z16' },
  { layer: 'pois', patch: '0003-pois-reaches-z16' },
] as const;

export interface MissingLayer {
  layer: string;
  /** The patch file expected to add it, named as it is in the patches directory. */
  patch: string;
}

/**
 * The enriched layers an archive is missing, each with the patch that should have added it.
 *
 * A layer can be absent for a reason that is not a broken patch (upstream changing its own
 * schema, a region with no buildings), which is why this is a warning in the report and not
 * a failed step — but a silent absence is how the published archive lost its names in the
 * first place, so it is always said out loud.
 */
export function missingEnrichedLayers(
  ids: readonly string[],
  patches: readonly string[],
): MissingLayer[] {
  const present = new Set(ids);
  return ENRICHED_LAYERS.filter(({ layer }) => !present.has(layer)).map(({ layer, patch }) => ({
    layer,
    patch: patches.find((name) => name.startsWith(patch)) ?? `${patch}.patch`,
  }));
}

/** What the machine offers, observed once and phrased so a failure can be one sentence. */
export interface ToolchainProbe {
  /** The java major version we found, or `null` when nothing answered. */
  javaMajor: number | null;
  /** Where java was looked for, in the operator's words. */
  javaLookedFor: string;
  /** The mvn executable we found, or `null`. */
  maven: string | null;
  /** Where mvn was looked for, in the operator's words. */
  mavenLookedFor: string;
}

/**
 * One sentence naming what is missing and where it was looked for, or `null`.
 *
 * Never a stack trace: a missing JDK is an expected state of a developer machine, and the
 * answer is a sentence an operator can act on, not a traceback from `spawn`.
 */
export function toolchainProblem(probe: ToolchainProbe): string | null {
  const javaMissing = probe.javaMajor === null || probe.javaMajor < 21;
  const mavenMissing = probe.maven === null;
  if (!javaMissing && !mavenMissing) return null;

  if (javaMissing && mavenMissing) {
    const found = probe.javaMajor === null ? '' : `, found java ${probe.javaMajor}`;
    return `JDK 21 and Maven are missing: looked for ${probe.javaLookedFor} and ${probe.mavenLookedFor}${found}; install a JDK 21 and Maven 3.9 or newer before building tiles.`;
  }

  if (javaMissing) {
    const found = probe.javaMajor === null ? '' : ` and found java ${probe.javaMajor}`;
    return `JDK 21 is missing: looked for ${probe.javaLookedFor}${found}; install a JDK 21 or point JAVA_HOME at one.`;
  }

  return `Maven is missing: looked for ${probe.mavenLookedFor}; install Maven 3.9 or newer.`;
}

/** `openjdk version "21.0.2"` → 21, `java version "1.8.0_392"` → 8. */
export function parseJavaMajor(output: string): number | null {
  const match = /version "(\d+)(?:\.(\d+))?/.exec(output);
  if (match === null) return null;
  const major = Number(match[1]);
  if (major !== 1) return major;
  const legacy = match[2] === undefined ? null : Number(match[2]);
  return legacy === null ? 1 : legacy;
}

/** Where `java` is taken from: `JAVA_HOME` when set, PATH otherwise. */
function javaExecutable(): string {
  const javaHome = process.env.JAVA_HOME;
  return javaHome === undefined || javaHome.length === 0 ? 'java' : join(javaHome, 'bin', 'java');
}

/**
 * What this machine offers. Both checks are allowed to fail without throwing.
 *
 * The java probe asks the very executable `run-tiler` will spawn, and nothing else: a stale
 * `JAVA_HOME` with a good `java` on PATH used to pass here and fail minutes later inside the
 * tiler, which is the one failure this preflight exists to prevent.
 */
export function probeToolchain(): ToolchainProbe {
  const executable = javaExecutable();
  const javaLookedFor =
    executable === 'java' ? '`java` on PATH (`JAVA_HOME` is not set)' : '`$JAVA_HOME/bin/java`';

  const javaResult = spawnSync(executable, ['-version'], { encoding: 'utf8' });
  const javaMajor = javaResult.error
    ? null
    : parseJavaMajor(`${javaResult.stderr ?? ''}${javaResult.stdout ?? ''}`);

  const mavenResult = spawnSync('mvn', ['-v'], { encoding: 'utf8' });
  const maven = mavenResult.error ? null : 'mvn';

  return { javaMajor, javaLookedFor, maven, mavenLookedFor: '`mvn` on PATH' };
}

/** The exit code of one command, with start failures kept as data. */
export interface CommandResult {
  exitCode: number;
  /** Set when the process could not be started at all, e.g. ENOENT. */
  error?: string;
}

/**
 * Runs one command in its own directory, inheriting stdout and stderr.
 *
 * Both streams stay attached to the operator's terminal on purpose: Maven writes its
 * `[ERROR]` lines to stdout and planetiler writes its progress there too, so capturing
 * stdout meant a failed jar build printed only "the profile jar build failed" and a slow
 * download printed nothing for minutes. No step reads the output to decide anything.
 */
export function runCommand(command: Command): Promise<CommandResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command.file, command.args, {
      cwd: command.cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    child.on('error', (error) => {
      resolvePromise({ exitCode: 127, error: reasonOf(error) });
    });
    child.on('close', (code) => {
      resolvePromise({ exitCode: code ?? 1 });
    });
  });
}

export interface StepOutcome {
  exitCode: number;
  /** A readable reason when the step itself decided to stop, e.g. no jar was produced. */
  message?: string;
}

export interface StepContext {
  plan: BuildPlan;
  /** How long every finished step took, keyed by the step label; the report reads the tiler's. */
  elapsedMs: Record<string, number>;
}

/** The one seam every step runs through. Tests inject a recorder; production runs commands. */
export type StepExecutor = (step: BuildStep, context: StepContext) => Promise<StepOutcome>;

export interface GuardedResult {
  exitCode: number;
  /** True when the attempt was stopped for delivering nothing, so retrying is the answer. */
  stalled: boolean;
}

export interface ExecutorDeps {
  log?: (line: string) => void;
  run?: (command: Command) => Promise<CommandResult>;
  readVectorLayers?: (path: string) => string[] | null;
  sizeOf?: (path: string) => number | null;
  /** Verified downloads, injected so a test never needs a mirror. */
  download?: (options: DownloadOptions) => Promise<DownloadResult>;
  /** Runs a command under the stall guard, injected so a test never needs a server. */
  guard?: (command: Command, watchDir: string) => Promise<GuardedResult>;
}

/** The jar the tiler runs: exactly one `*-with-deps.jar` in `target/`. */
function listJars(dir: string): string[] | null {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(JAR_SUFFIX))
      .sort()
      .map((name) => join(dir, name));
  } catch {
    return null;
  }
}

/** The one jar a step will run, or the sentence saying why there is not exactly one. */
function singleJar(dir: string): { path: string } | { message: string } {
  const jars = listJars(dir);
  if (jars === null || jars.length === 0) {
    return { message: `the profile jar was not built: ${dir} holds no ${JAR_SUFFIX} file.` };
  }
  if (jars.length > 1) {
    return {
      message: `${dir} holds ${jars.length} ${JAR_SUFFIX} files; remove the stale ones, the tiler would run one of them.`,
    };
  }
  return { path: jars[0] as string };
}

/** Total bytes under a directory, or zero while it does not exist yet. */
function directorySize(directory: string): number {
  let total = 0;
  try {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) total += directorySize(path);
      else if (entry.isFile()) total += sizeOfFile(path) ?? 0;
    }
  } catch {
    // A stage that has not written anything yet measures zero, which is a stall only once the
    // guard's window has passed.
  }
  return total;
}

/**
 * Runs one command, stopping it when what it produces stops growing.
 *
 * This is the guard for the sources planetiler fetches itself: its HTTP client has no speed
 * limit, so a mirror that stops sending while keeping the connection open blocks the build for
 * hours. Killing the attempt turns that into a bounded wait, and the download step retries.
 */
export function runWithProgressGuard(
  command: Command,
  watchDir: string,
  options: { stallMs?: number; intervalMs?: number } = {},
): Promise<GuardedResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command.file, command.args, {
      cwd: command.cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    let finished = false;
    let stalled = false;

    child.on('error', () => {
      finished = true;
      resolvePromise({ exitCode: 127, stalled });
    });
    child.on('close', (code) => {
      finished = true;
      resolvePromise({ exitCode: code ?? 1, stalled });
    });

    void guardProgress({
      measure: () => directorySize(watchDir),
      isDone: () => finished,
      stallMs: options.stallMs ?? SOURCE_STALL_MS,
      intervalMs: options.intervalMs ?? SOURCE_STALL_INTERVAL_MS,
      onStall: () => {
        stalled = true;
        child.kill('SIGKILL');
      },
    });
  });
}

/** Whether `dir` is already a git checkout at `commit`, which is what a re-run reuses. */
function checkoutAt(dir: string, commit: string): boolean {
  if (!existsSync(join(dir, '.git'))) return false;
  const head = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return head.status === 0 && head.stdout.trim() === commit;
}

function sizeOfFile(path: string): number | null {
  try {
    const info = statSync(path);
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

/** `vector_layers` ids out of a parsed PMTiles metadata document, or `null`. */
export function vectorLayerIdsFromMetadata(metadata: unknown): string[] | null {
  if (metadata === null || typeof metadata !== 'object') return null;
  const layers = (metadata as { vector_layers?: unknown }).vector_layers;
  if (!Array.isArray(layers)) return null;

  const ids = layers
    .map((layer) =>
      layer !== null && typeof layer === 'object' ? (layer as { id?: unknown }).id : undefined,
    )
    .filter((id): id is string => typeof id === 'string');
  return ids.length === layers.length ? ids : null;
}

/**
 * Reads `vector_layers` from a PMTiles v3 archive without a pmtiles dependency.
 *
 * The header is 127 bytes: bytes 24-31 are the JSON metadata offset and 32-39 its length,
 * byte 97 is the compression of that metadata (1 none, 2 gzip). The metadata is where
 * planetiler writes `vector_layers`, so this is the whole archive that has to be touched to
 * report what the build produced.
 */
export function readVectorLayersFromArchive(path: string): string[] | null {
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    const header = Buffer.alloc(127);
    if (readSync(fd, header, 0, header.length, 0) !== header.length) return null;
    if (header.subarray(0, 7).toString('utf8') !== 'PMTiles') return null;

    const offset = Number(header.readBigUInt64LE(24));
    const length = Number(header.readBigUInt64LE(32));
    // A sane metadata block is kilobytes; a wild length means this is not an archive we can
    // read, and trusting it would mean allocating whatever the file claims.
    if (length === 0 || length > 64 * 1024 * 1024) return null;

    const raw = Buffer.alloc(length);
    if (readSync(fd, raw, 0, length, offset) !== length) return null;

    const compression = header[97];
    const json = compression === 1 ? raw : compression === 2 ? gunzipSync(raw) : null;
    if (json === null) return null;

    return vectorLayerIdsFromMetadata(JSON.parse(json.toString('utf8')));
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

/**
 * The production executor: the only place that runs a process or touches the archive.
 *
 * A step that cannot do its job returns a sentence in `message` and a non-zero code, so the
 * run loop reports it exactly like a failed command — one stop, one named step.
 */
export function createExecutor(deps: ExecutorDeps = {}): StepExecutor {
  const log = deps.log ?? ((line: string) => console.log(line));
  const run = deps.run ?? runCommand;
  const readVectorLayers = deps.readVectorLayers ?? readVectorLayersFromArchive;
  const sizeOf = deps.sizeOf ?? sizeOfFile;
  const guard = deps.guard ?? runWithProgressGuard;
  const download = deps.download ?? downloadVerified;

  const failed = (result: CommandResult, fallback: string): StepOutcome => ({
    exitCode: result.exitCode,
    message: result.error === undefined ? fallback : `${fallback}: ${result.error}`,
  });

  return async (step, context) => {
    switch (step.kind) {
      case 'read-pin': {
        log(`pin: ${step.repository} at ${step.commit}`);
        return { exitCode: 0 };
      }

      case 'sync-upstream': {
        if (checkoutAt(step.dir, step.commit)) {
          // Reused without a download; the `reset-checkout` step that follows makes the tree the
          // one a fresh clone would have given us.
          log(`reusing the checkout at ${step.dir} (already at ${step.commit.slice(0, 7)})`);
          return { exitCode: 0 };
        }

        // A checkout we already have is cheaper to move than to clone again: re-pinning only
        // needs the new commit fetched, not the whole tree downloaded a second time.
        if (existsSync(join(step.dir, '.git'))) {
          log(`fetching the new pin in ${step.dir}`);
          const fetch = await run({
            file: 'git',
            args: ['-C', step.dir, 'fetch', 'origin'],
            cwd: step.dir,
          });
          if (fetch.exitCode !== 0) {
            return failed(fetch, `fetching ${step.repository} in ${step.dir} failed`);
          }
          // No `checkout` here: the previous run's patches are still applied, and git refuses
          // to move HEAD over them — which is exactly the file upstream touched. The
          // `reset-checkout` step that follows moves HEAD to the pin and clears the tree.
          return { exitCode: 0 };
        }

        mkdirSync(dirname(step.dir), { recursive: true });
        const clone = await run({
          file: 'git',
          args: ['clone', step.repository, step.dir],
          cwd: dirname(step.dir),
        });
        if (clone.exitCode !== 0) {
          return failed(clone, `cloning ${step.repository} into ${step.dir} failed`);
        }

        const checkout = await run({
          file: 'git',
          args: ['-C', step.dir, 'checkout', '--detach', step.commit],
          cwd: step.dir,
        });
        if (checkout.exitCode !== 0) {
          return failed(checkout, `checking out ${step.commit} in ${step.dir} failed`);
        }
        return { exitCode: 0 };
      }

      case 'reset-checkout': {
        const short = step.commit.slice(0, 7);
        log(`resetting ${step.dir} to ${short}`);
        for (const command of step.commands) {
          const result = await run(command);
          if (result.exitCode !== 0) {
            return failed(
              result,
              `resetting the checkout at ${step.dir} to ${short} failed (git ${command.args.slice(2).join(' ')})`,
            );
          }
        }
        return { exitCode: 0 };
      }

      case 'apply-patch': {
        const result = await run(step.command);
        if (result.exitCode !== 0) {
          return failed(result, `${basename(step.patch)} did not apply`);
        }
        return { exitCode: 0 };
      }

      case 'build-jar': {
        log(`building the profile jar in ${step.command.cwd}`);
        const result = await run(step.command);
        if (result.exitCode !== 0) {
          return failed(result, 'the profile jar build failed');
        }
        return { exitCode: 0 };
      }

      case 'fetch-osm': {
        log(`downloading ${step.url}`);
        const result = await download({
          url: step.url,
          destination: step.destination,
          verify: osmPbfProblem,
        });
        if (!result.ok) {
          return {
            exitCode: 1,
            message: `downloading ${step.url} failed: ${result.message ?? 'no reason given'}`,
          };
        }
        const how = result.cached
          ? 'already there'
          : result.resumedFrom > 0
            ? `resumed at ${result.resumedFrom} bytes`
            : 'downloaded';
        log(`  ${step.destination}: ${result.bytes} bytes (${how})`);
        return { exitCode: 0 };
      }

      case 'download-sources': {
        const jar = singleJar(step.jarDir);
        if ('message' in jar) return { exitCode: 1, message: jar.message };
        const problem = jarProblem(jar.path);
        if (problem !== null) return { exitCode: 1, message: problem };

        mkdirSync(step.cwd, { recursive: true });
        log(`downloading the tiler's sources into ${step.cwd}`);
        for (let attempt = 1; attempt <= SOURCE_DOWNLOAD_ATTEMPTS; attempt += 1) {
          const result = await guard(
            { file: javaExecutable(), args: ['-jar', jar.path, ...step.args], cwd: step.cwd },
            step.cwd,
          );
          if (!result.stalled && result.exitCode === 0) return { exitCode: 0 };
          if (!result.stalled) {
            return {
              exitCode: result.exitCode,
              message: `downloading the tiler's sources into ${step.cwd} failed with exit code ${result.exitCode}.`,
            };
          }
          log(
            `  the download stalled: nothing grew for ${Math.round(SOURCE_STALL_MS / 1000)}s, so the attempt was stopped and retried (${attempt} of ${SOURCE_DOWNLOAD_ATTEMPTS})`,
          );
        }
        return {
          exitCode: 1,
          message: `downloading the tiler's sources into ${step.cwd} stalled ${SOURCE_DOWNLOAD_ATTEMPTS} times: a mirror kept the connection open without sending bytes, and the run gave up instead of waiting for it.`,
        };
      }

      case 'verify-sources': {
        log(`verifying every source in ${step.sourcesDir}`);
        const problems = sourcesProblems(step.sourcesDir);
        if (!existsSync(step.osmPath)) {
          problems.push(
            `${step.osmPath} is missing: the extract this region is cut from was never downloaded.`,
          );
        }
        if (problems.length > 0) {
          const shown = problems.slice(0, 3).join(' ');
          const rest = problems.length > 3 ? ` (and ${problems.length - 3} more)` : '';
          return { exitCode: 1, message: `${shown}${rest}` };
        }
        return { exitCode: 0 };
      }

      case 'run-tiler': {
        const jar = singleJar(step.jarDir);
        if ('message' in jar) return { exitCode: 1, message: jar.message };
        // A nine-byte `Not Found` saved as a jar is what the spike ran once; the manifest check
        // costs one file read and refuses it before java is spawned.
        const problem = jarProblem(jar.path);
        if (problem !== null) return { exitCode: 1, message: problem };

        mkdirSync(step.cwd, { recursive: true });
        log(`tiling ${step.bounds} at z${step.maxzoom} → ${step.output}`);
        const result = await run({
          file: javaExecutable(),
          args: [TILER_HEAP, '-jar', jar.path, ...tilerArgs(step)],
          cwd: step.cwd,
        });
        if (result.exitCode !== 0) {
          return failed(result, 'the tiler failed');
        }
        return { exitCode: 0 };
      }

      case 'report': {
        const tilerStep = context.plan.steps.find(
          (candidate): candidate is Extract<BuildStep, { kind: 'run-tiler' }> =>
            candidate.kind === 'run-tiler',
        );
        const elapsed = tilerStep === undefined ? undefined : context.elapsedMs[tilerStep.label];
        const size = sizeOf(step.output);
        const ids = readVectorLayers(step.output);

        log('');
        log(`archive: ${step.output}`);
        log(`  size: ${size === null ? 'unknown (the archive is missing)' : `${size} bytes`}`);
        log(`  tile step: ${elapsed === undefined ? 'not timed' : `${elapsed} ms`}`);

        if (ids === null) {
          log(
            `warning: could not read vector_layers from ${step.output}; check it before uploading`,
          );
        } else {
          log(`  vector_layers: ${ids.join(', ')}`);
          for (const missing of missingEnrichedLayers(ids, context.plan.patches)) {
            log(
              `warning: ${missing.layer} is missing from the archive: ${missing.patch} should have added it`,
            );
          }
        }

        log('');
        log('Upload it with:');
        log(
          `  make api-upload-map-tiles-staging REGION=${context.plan.region} VERSION=<version> ARCHIVE=${step.output} STYLE=<style>`,
        );
        log(`Keep the cache directory for the next run: ${context.plan.cacheDir}`);
        return { exitCode: 0 };
      }
    }
  };
}

export interface RunDeps extends Partial<PlanDeps> {
  probeToolchain?: () => ToolchainProbe;
  executor?: StepExecutor;
  /** Injected clock, so a test can state elapsed times instead of measuring them. */
  now?: () => number;
  log?: (line: string) => void;
}

export interface BuildResult {
  ok: boolean;
  /** The step that stopped the run, when one did. */
  step?: BuildStep;
  exitCode?: number;
  /** One sentence for the operator; never a stack trace. */
  message?: string;
}

/** How a failed step reads in the operator's terminal. */
function describeFailure(step: BuildStep, exitCode: number): string {
  if (step.kind === 'apply-patch') {
    return `patch ${basename(step.patch)} did not apply (git apply exited ${exitCode}); the build stopped before the jar build, so nothing was compiled — read the upstream change and re-generate the patch.`;
  }
  return `step "${step.label}" failed with exit code ${exitCode}.`;
}

/**
 * Plan, check the machine, then run one step at a time.
 *
 * A failed step ends the run: the loop returns before the next one, so a patch that does not
 * apply cannot be followed by a jar build of a half-patched profile.
 */
export async function runBuild(options: BuildOptions, deps: RunDeps = {}): Promise<BuildResult> {
  const plan = planBuild(options, { readFile: deps.readFile, listDir: deps.listDir });
  const log = deps.log ?? ((line: string) => console.log(line));

  const problem = toolchainProblem((deps.probeToolchain ?? probeToolchain)());
  if (problem !== null) return { ok: false, message: problem };

  log(`Building ${plan.region} at z${plan.maxzoom} (bounds ${plan.bounds})`);
  log(`  pin:    ${plan.repository} at ${plan.commit}`);
  log(`  cache:  ${plan.cacheDir} (keep it: the checkout and the auxiliary sources are reused)`);
  log(`  output: ${plan.output}`);
  log('');

  const executor = deps.executor ?? createExecutor({ log });
  const now = deps.now ?? (() => Date.now());
  const elapsedMs: Record<string, number> = {};

  for (const step of plan.steps) {
    const startedAt = now();
    let outcome: StepOutcome;
    try {
      outcome = await executor(step, { plan, elapsedMs });
    } catch (error) {
      return { ok: false, step, message: `${step.label} threw: ${reasonOf(error)}` };
    }
    elapsedMs[step.label] = now() - startedAt;

    if (outcome.exitCode !== 0) {
      return {
        ok: false,
        step,
        exitCode: outcome.exitCode,
        message: outcome.message ?? describeFailure(step, outcome.exitCode),
      };
    }
  }

  return { ok: true };
}

/** `--name=value` or `--name value`, the same shape the other scripts use. */
function flag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const index = argv.indexOf(`--${name}`);
  if (inline === undefined && index === -1) return undefined;

  const value = inline !== undefined ? inline.slice(prefix.length) : (argv[index + 1] ?? '');
  // A blank value is not a small value: `Number('')` is 0, which is a zoom the profile emits,
  // and `resolve('')` is the process cwd, where the reset step would then `git clean -fdx`.
  if (value.trim().length === 0) {
    throw new Error(
      `--${name} needs a value, got "${value}": a blank one is not usable, so the run stops instead of guessing.`,
    );
  }
  return value;
}

/** The repository this file lives in, so a run from anywhere reads the same patches. */
export function repoRootFromModule(): string {
  return resolve(fileURLToPath(new URL('../..', import.meta.url)));
}

export function parseArgs(argv: string[]): BuildOptions {
  const region = flag(argv, 'region');
  if (region === undefined) {
    throw new Error(`--region is required (one of ${Object.keys(MAP_REGIONS).join(', ')}).`);
  }

  const maxzoomText = flag(argv, 'maxzoom');
  const maxzoom = maxzoomText === undefined ? DEFAULT_MAXZOOM : Number(maxzoomText);
  const cacheDir = resolve(flag(argv, 'cache') ?? DEFAULT_CACHE_DIR);

  return {
    region,
    maxzoom,
    cacheDir,
    workDir: join(cacheDir, CHECKOUT_DIR_NAME),
    repoRoot: repoRootFromModule(),
  };
}

async function main(argv: string[]): Promise<number> {
  let options: BuildOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`map-tiles-build: ${reasonOf(error)}`);
    console.error('');
    console.error(USAGE);
    return 1;
  }

  try {
    const result = await runBuild(options);
    if (result.ok) return 0;

    console.error(`map-tiles-build: ${result.message ?? 'the build failed'}`);
    if (result.step !== undefined) console.error(`  stopped at: ${result.step.label}`);
    return 1;
  } catch (error) {
    // Planning failures land here: one sentence, no stack.
    console.error(`map-tiles-build: ${reasonOf(error)}`);
    return 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
