import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { MAP_REGIONS, bboxTuple } from '../../../packages/shared/src/map/regions';
import {
  DEFAULT_CACHE_DIR,
  DEFAULT_MAXZOOM,
  MAP_TILE_EXTRACTS,
  type BuildOptions,
  type BuildPlan,
  type BuildStep,
  type Command,
  type StepExecutor,
  type ToolchainProbe,
  createExecutor,
  missingEnrichedLayers,
  parseArgs,
  planBuild,
  probeToolchain,
  runBuild,
  runCommand,
  tilerArgs,
  toolchainProblem,
} from '../build';
import { type DownloadOptions, osmPbfProblem } from '../download';
import { osmPbfHeader, storedZip, writeJar } from './archives';

/** A repository root that is not the working tree, so "absolute" means "not from cwd". */
const REPO_ROOT = '/srv/sonora';

const PATCH_NAMES = [
  '0001-landuse-keeps-its-name.patch',
  '0002-buildings-name-and-z16.patch',
  '0003-pois-reaches-z16.patch',
];

const PIN = JSON.stringify({
  repository: 'https://github.com/protomaps/basemaps.git',
  commit: '42ffaaa4a85a41bfcb23e43cc0f5b492a5eca123',
  module: 'tiles',
});

const OPTIONS: BuildOptions = {
  region: 'calamuchita',
  maxzoom: DEFAULT_MAXZOOM,
  cacheDir: '/var/tmp/sonora-map-tiles',
  workDir: '/var/tmp/sonora-map-tiles/basemaps',
  repoRoot: REPO_ROOT,
};

/** Plan dependencies that never touch the disk, so a test owns the pin and the patch list. */
function planDeps(
  overrides: {
    readFile?: () => string;
    listDir?: () => string[];
    extracts?: Record<string, string>;
  } = {},
) {
  return {
    readFile: overrides.readFile ?? (() => PIN),
    listDir: overrides.listDir ?? (() => [...PATCH_NAMES]),
    ...(overrides.extracts === undefined ? {} : { extracts: overrides.extracts }),
  };
}

function plan(overrides: Partial<BuildOptions> = {}, deps = planDeps()): BuildPlan {
  return planBuild({ ...OPTIONS, ...overrides }, deps);
}

/** One step of a plan, by kind, so a test never indexes into an order it did not state. */
function stepOf<K extends BuildStep['kind']>(
  built: BuildPlan,
  kind: K,
): Extract<BuildStep, { kind: K }> {
  const step = built.steps.find(
    (candidate): candidate is Extract<BuildStep, { kind: K }> => candidate.kind === kind,
  );
  if (step === undefined) throw new Error(`the plan has no ${kind} step`);
  return step;
}

const TOOLCHAIN: ToolchainProbe = {
  javaMajor: 21,
  javaLookedFor: '`$JAVA_HOME/bin/java` and `java` on PATH',
  maven: '/usr/bin/mvn',
  mavenLookedFor: '`mvn` on PATH',
};

/** An executor that records every step and fails the first one whose label says so. */
function recorder(failOn?: string): { steps: BuildStep[]; executor: StepExecutor } {
  const steps: BuildStep[] = [];
  const executor: StepExecutor = async (step) => {
    steps.push(step);
    if (failOn !== undefined && step.label.includes(failOn)) {
      return { exitCode: 7 };
    }
    return { exitCode: 0 };
  };
  return { steps, executor };
}

function run(
  options: Partial<BuildOptions>,
  executor: StepExecutor,
  probe: ToolchainProbe = TOOLCHAIN,
  deps = planDeps(),
) {
  return runBuild(
    { ...OPTIONS, ...options },
    {
      ...deps,
      executor,
      probeToolchain: () => probe,
      now: () => 0,
      log: () => {},
    },
  );
}

/** Runs git in `dir` without this machine's own config, so the test owns the repo it builds. */
function git(dir: string, args: string[]): string {
  const result = spawnSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

/** A checkout at the pin, left the way a run leaves it: patch changes, and what the patch added. */
function checkoutLeftByPreviousRun(dir: string): string {
  mkdirSync(dir, { recursive: true });
  git(dir, ['init', '--quiet']);
  writeFileSync(join(dir, 'PROFILE.md'), 'upstream\n');
  git(dir, ['add', '.']);
  git(dir, [
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@example.invalid',
    'commit',
    '-q',
    '-m',
    'pin',
  ]);
  writeFileSync(join(dir, 'PROFILE.md'), 'patched\n');
  writeFileSync(join(dir, 'leftover.txt'), 'left by the previous run\n');
  return git(dir, ['rev-parse', 'HEAD']).trim();
}

/** The pin the plan reads, with `commit` as the pinned commit. */
function pinAt(commit: string) {
  return JSON.stringify({ ...JSON.parse(PIN), commit });
}

/**
 * An upstream with two commits and a checkout at the first one, left dirty by a run at the old
 * pin: `PROFILE.md` was edited by a patch and `leftover.txt` was added. Re-pinning to the second
 * commit is the case where git refuses the `checkout` because that patch change is in the way.
 */
function checkoutAtAnOldPin(root: string): { workDir: string; newCommit: string } {
  const originDir = join(root, 'origin');
  mkdirSync(originDir, { recursive: true });
  git(originDir, ['init', '--quiet']);
  writeFileSync(join(originDir, 'PROFILE.md'), 'upstream v1\n');
  git(originDir, ['add', '.']);
  git(originDir, [
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@example.invalid',
    'commit',
    '-q',
    '-m',
    'v1',
  ]);

  const workDir = join(root, 'basemaps');
  git(root, ['clone', '--quiet', originDir, workDir]);

  // Upstream moves and the pin moves with it; the checkout below is still at the old commit.
  writeFileSync(join(originDir, 'PROFILE.md'), 'upstream v2\n');
  git(originDir, [
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@example.invalid',
    'commit',
    '-q',
    '-am',
    'v2',
  ]);
  const newCommit = git(originDir, ['rev-parse', 'HEAD']).trim();

  writeFileSync(join(workDir, 'PROFILE.md'), 'patched v1\n');
  writeFileSync(join(workDir, 'leftover.txt'), 'left by the previous run\n');

  return { workDir, newCommit };
}

/** `#!/bin/sh` that records every call in `log` and answers `-version` with `report`. */
function fakeJava(path: string, log: string, report: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    [
      '#!/bin/sh',
      `echo "$@" >> '${log}'`,
      `case "$1" in -version) echo '${report}' >&2 ;; esac`,
      'exit 0',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
}

/** Parses argv the way `main` does, then runs the plan; a rejection is returned, not rethrown. */
async function runArgv(argv: string[]): Promise<{ error?: string; steps: BuildStep[] }> {
  const { steps, executor } = recorder();
  try {
    const options = parseArgs(argv);
    await runBuild(options, {
      ...planDeps(),
      executor,
      probeToolchain: () => TOOLCHAIN,
      now: () => 0,
      log: () => {},
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), steps };
  }
  return { steps };
}

describe('planBuild', () => {
  it('throws a readable error for an unknown region', () => {
    expect(() => plan({ region: 'patagonia' })).toThrow(
      /unknown region "patagonia".*MAP_REGIONS declares calamuchita/,
    );
  });

  it('throws a readable error when the pinned upstream has no commit', () => {
    const deps = planDeps({
      readFile: () => JSON.stringify({ repository: 'https://github.com/protomaps/basemaps.git' }),
    });
    expect(() => plan({}, deps)).toThrow(/upstream\.json has no commit/);
  });

  it('throws a readable error when the pinned upstream cannot be read', () => {
    const deps = planDeps({
      readFile: () => {
        throw new Error('ENOENT: no such file or directory');
      },
    });
    expect(() => plan({}, deps)).toThrow(
      /cannot read the pinned upstream at \/srv\/sonora\/scripts\/map-tiles\/upstream\.json: ENOENT/,
    );
  });

  it('throws a readable error when the patches directory holds no patches', () => {
    expect(() => plan({}, planDeps({ listDir: () => [] }))).toThrow(
      /the patches directory is empty: \/srv\/sonora\/scripts\/map-tiles\/patches/,
    );
  });

  it('throws a readable error when maxzoom is deeper than the profile can emit', () => {
    expect(() => plan({ maxzoom: 17 })).toThrow(
      /maxzoom 17 is outside what the profile can emit.*0-16/,
    );
    expect(() => plan({ maxzoom: -1 })).toThrow(/maxzoom -1 is outside what the profile can emit/);
  });

  it('plans the pin, every patch, the jar, the verified sources and then the tiler', () => {
    const steps = plan().steps;
    expect(steps.map((step) => step.kind)).toEqual([
      'read-pin',
      'sync-upstream',
      'reset-checkout',
      'apply-patch',
      'apply-patch',
      'apply-patch',
      'build-jar',
      'fetch-osm',
      'fetch-shapes',
      'download-sources',
      'verify-sources',
      'run-tiler',
      'report',
    ]);
    expect(
      steps.flatMap((step) => (step.kind === 'apply-patch' ? [step.patch.split('/').pop()] : [])),
    ).toEqual(PATCH_NAMES);
  });

  it('passes absolute patch paths to the executor, whatever the process cwd is', () => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'map-tiles-cwd-'));
    const previous = process.cwd();
    try {
      process.chdir(elsewhere);
      const patches = plan()
        .steps.filter(
          (step): step is Extract<BuildStep, { kind: 'apply-patch' }> =>
            step.kind === 'apply-patch',
        )
        .map((step) => step.command.args);

      expect(patches).toHaveLength(PATCH_NAMES.length);
      patches.forEach((args, index) => {
        const patch = args[args.length - 1];
        expect(isAbsolute(patch)).toBe(true);
        expect(patch).toBe(join(REPO_ROOT, 'scripts/map-tiles/patches', PATCH_NAMES[index]));
        expect(patch.startsWith(elsewhere)).toBe(false);
      });
    } finally {
      process.chdir(previous);
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it("carries the region's bbox in planetiler's order and the requested maxzoom to the tiler", () => {
    const step = plan({ maxzoom: 15 }).steps.find(
      (candidate): candidate is Extract<BuildStep, { kind: 'run-tiler' }> =>
        candidate.kind === 'run-tiler',
    );
    if (step === undefined) throw new Error('the plan has no tiler step');

    const box = bboxTuple(MAP_REGIONS.calamuchita.bbox);
    expect(box).not.toBeNull();
    expect(step.bounds).toBe(box?.join(','));
    expect(step.bounds).toBe('-64.83,-32.28,-64.66,-32.12');

    const args = tilerArgs(step);
    expect(args).toContain('--bounds=-64.83,-32.28,-64.66,-32.12');
    expect(args).toContain('--maxzoom=15');
    expect(args).toContain(`--output=${step.output}`);
    // The extract is named, never left to planetiler's `--area` default: "monaco" is what a
    // build without it tiles, silently, for a region in Argentina.
    expect(args).toContain(`--osm-path=${step.osmPath}`);
    expect(step.cwd).toBe('/var/tmp/sonora-map-tiles/planetiler');
    expect(args.some((arg) => arg.startsWith('--data-dir='))).toBe(false);
  });

  it('declares the Geofabrik extract of every region, so a build can never tile Monaco', () => {
    for (const region of Object.keys(MAP_REGIONS)) {
      expect(MAP_TILE_EXTRACTS[region as keyof typeof MAP_REGIONS]).toMatch(/^[a-z-]+\/[a-z-]+$/);
    }
    expect(MAP_TILE_EXTRACTS.calamuchita).toBe('south-america/argentina');
  });

  it('fetches the extract into the sources cache and tiles from there, outside the checkout', () => {
    const built = plan();
    const fetch = stepOf(built, 'fetch-osm');
    expect(fetch.url).toBe('https://download.geofabrik.de/south-america/argentina-latest.osm.pbf');
    expect(fetch.destination).toBe(
      '/var/tmp/sonora-map-tiles/planetiler/data/sources/argentina.osm.pbf',
    );

    const tiler = stepOf(built, 'run-tiler');
    expect(tiler.osmPath).toBe(fetch.destination);
    expect(tiler.cwd).toBe('/var/tmp/sonora-map-tiles/planetiler');
    // The reset step runs `clean -fdx` inside the checkout, so a source that lives there would
    // be deleted by the next run: the sources cache is a sibling, never a child of it.
    expect(tiler.cwd.startsWith(`${built.workDir}/`)).toBe(false);
  });

  it('fetches the two osmdata archives itself, into the sources directory the tiler reads', () => {
    const built = plan();
    const shapes = stepOf(built, 'fetch-shapes');

    expect(shapes.archives.map((archive) => archive.url)).toEqual([
      'https://osmdata.openstreetmap.de/download/water-polygons-split-3857.zip',
      'https://osmdata.openstreetmap.de/download/land-polygons-split-3857.zip',
    ]);
    for (const archive of shapes.archives) {
      expect(archive.destination.startsWith(`${built.sourcesDir}/data/sources/`)).toBe(true);
    }
    // Before the tiler's own download stage, so that stage finds them and skips them.
    const order = built.steps.map((step) => step.kind);
    expect(order.indexOf('fetch-shapes')).toBeLessThan(order.indexOf('download-sources'));
  });

  it('refuses to plan a region with no declared extract', () => {
    expect(() => planBuild({ ...OPTIONS }, planDeps({ extracts: {} }))).toThrow(
      /no Geofabrik extract for "calamuchita"/,
    );
  });
});

describe('toolchainProblem', () => {
  it('reports a missing JDK 21 and Maven as one sentence naming where it looked', () => {
    const problem = toolchainProblem({
      javaMajor: null,
      javaLookedFor: '`$JAVA_HOME/bin/java` and `java` on PATH',
      maven: null,
      mavenLookedFor: '`mvn` on PATH',
    });

    if (problem === null) throw new Error('a missing toolchain was not reported');
    expect(problem.includes('\n')).toBe(false);
    // Split only on a period followed by whitespace, so "Maven 3.9" is not two sentences.
    expect(problem.split(/(?<=\.)\s+/).filter((part) => part.trim().length > 0)).toHaveLength(1);
    expect(problem.endsWith('.')).toBe(true);
    expect(problem).toContain('JDK 21');
    expect(problem).toContain('Maven');
    expect(problem).toContain('PATH');
  });

  it('is silent when a JDK 21 and Maven are both present', () => {
    expect(toolchainProblem(TOOLCHAIN)).toBeNull();
  });
});

describe('runBuild', () => {
  it('stops before the jar build when a patch does not apply, naming the patch', async () => {
    const { steps, executor } = recorder('0002-buildings-name-and-z16');
    const result = await run({}, executor);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('0002-buildings-name-and-z16.patch');
    expect(result.message).toContain('before the jar build');
    expect(result.exitCode).toBe(7);
    expect(steps.map((step) => step.kind)).toEqual([
      'read-pin',
      'sync-upstream',
      'reset-checkout',
      'apply-patch',
      'apply-patch',
    ]);
    expect(steps.some((step) => step.kind === 'build-jar')).toBe(false);
  });

  it('runs every step of a successful plan exactly once and in order', async () => {
    const { steps, executor } = recorder();
    const result = await run({}, executor);

    expect(result.ok).toBe(true);
    expect(steps.map((step) => step.kind)).toEqual([
      'read-pin',
      'sync-upstream',
      'reset-checkout',
      'apply-patch',
      'apply-patch',
      'apply-patch',
      'build-jar',
      'fetch-osm',
      'fetch-shapes',
      'download-sources',
      'verify-sources',
      'run-tiler',
      'report',
    ]);
    expect(new Set(steps.map((step) => step.label)).size).toBe(steps.length);
  });

  it('resets a checkout already at the pin before the first patch, so a warm cache builds like a cold one', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-reuse-'));
    const workDir = join(root, 'basemaps');
    try {
      const commit = checkoutLeftByPreviousRun(workDir);
      const options: Partial<BuildOptions> = { workDir, cacheDir: join(root, 'cache') };
      const deps = planDeps({ readFile: () => pinAt(commit) });

      const commands: Command[] = [];
      /** The tree the first patch meets, and nothing else. */
      let treeAtFirstPatch: string | null = null;
      const executor = createExecutor({
        log: () => {},
        // The sources stages are not what this test is about: they answer as if they had run.
        // The extract is written where the real download would put it, so the verification
        // step that follows runs for real instead of being stubbed away.
        download: async (options: DownloadOptions) => {
          mkdirSync(dirname(options.destination), { recursive: true });
          // The extract is a PBF and the shape archives are zips: the verification step that
          // follows runs for real, so each stub has to write what its own check accepts.
          writeFileSync(
            options.destination,
            options.destination.endsWith('.pbf') ? osmPbfHeader() : storedZip('shape.shp'),
          );
          return { ok: true, bytes: 1, resumedFrom: 0, attempts: 1, cached: false };
        },
        guard: async () => ({ exitCode: 0, stalled: false }),
        run: async (command) => {
          commands.push(command);
          if (command.args.includes('apply') && treeAtFirstPatch === null) {
            treeAtFirstPatch = git(workDir, ['status', '--porcelain']);
          }
          // Only the reset is real; the patches, the jar build and the tiler are recorded.
          if (command.file === 'git' && !command.args.includes('apply')) return runCommand(command);
          if (command.file === 'mvn') {
            mkdirSync(join(workDir, 'tiles', 'target'), { recursive: true });
            writeJar(join(workDir, 'tiles', 'target', 'x-with-deps.jar'));
          }
          return { exitCode: 0 };
        },
      });

      const result = await run(options, executor, TOOLCHAIN, deps);

      expect(result.ok).toBe(true);
      expect(commands.filter((command) => command.args.includes('clone'))).toHaveLength(0);
      expect(treeAtFirstPatch).toBe('');
      expect(existsSync(join(workDir, 'leftover.txt'))).toBe(false);
      expect(git(workDir, ['rev-parse', 'HEAD']).trim()).toBe(commit);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('stops with a one-sentence message instead of running a step when the toolchain is missing', async () => {
    const { steps, executor } = recorder();
    const result = await run({}, executor, {
      javaMajor: null,
      javaLookedFor: '`java` on PATH',
      maven: null,
      mavenLookedFor: '`mvn` on PATH',
    });

    expect(result.ok).toBe(false);
    expect(result.message?.startsWith('JDK 21 and Maven are missing')).toBe(true);
    expect(result.step).toBeUndefined();
    expect(steps).toHaveLength(0);
  });

  it('moves a dirty checkout to a new pin by fetching, leaving the move to the reset step', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-repin-'));
    try {
      const { workDir, newCommit } = checkoutAtAnOldPin(root);
      const deps = planDeps({ readFile: () => pinAt(newCommit) });

      const commands: Command[] = [];
      const executor = createExecutor({
        log: () => {},
        readVectorLayers: () => ['landuse', 'buildings', 'pois'],
        sizeOf: () => 1234,
        // The extract is written where the real download would put it, so the verification
        // step that follows runs for real instead of being stubbed away.
        download: async (options: DownloadOptions) => {
          mkdirSync(dirname(options.destination), { recursive: true });
          // The extract is a PBF and the shape archives are zips: the verification step that
          // follows runs for real, so each stub has to write what its own check accepts.
          writeFileSync(
            options.destination,
            options.destination.endsWith('.pbf') ? osmPbfHeader() : storedZip('shape.shp'),
          );
          return { ok: true, bytes: 1, resumedFrom: 0, attempts: 1, cached: false };
        },
        guard: async () => ({ exitCode: 0, stalled: false }),
        run: async (command) => {
          commands.push(command);
          // The patches are the real ones' names, not a diff this test repository can apply.
          if (command.file === 'git' && command.args.includes('apply')) return { exitCode: 0 };
          if (command.file === 'git') return runCommand(command);
          if (command.file === 'mvn') {
            mkdirSync(join(workDir, 'tiles', 'target'), { recursive: true });
            writeJar(join(workDir, 'tiles', 'target', 'x-with-deps.jar'));
          }
          return { exitCode: 0 };
        },
      });

      const result = await run(
        { workDir, cacheDir: join(root, 'cache') },
        executor,
        TOOLCHAIN,
        deps,
      );

      if (!result.ok) throw new Error(`the re-pin failed: ${result.message ?? 'no message'}`);
      expect(result.ok).toBe(true);
      // `checkout --detach` is what git refuses while the previous run's patches are applied;
      // the reset step that follows is what moves HEAD, so sync-upstream only fetches.
      expect(commands.filter((command) => command.args.includes('checkout'))).toHaveLength(0);
      expect(commands.some((command) => command.args.includes('fetch'))).toBe(true);
      expect(git(workDir, ['rev-parse', 'HEAD']).trim()).toBe(newCommit);
      expect(readFileSync(join(workDir, 'PROFILE.md'), 'utf8')).toBe('upstream v2\n');
      expect(existsSync(join(workDir, 'leftover.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * The stages that face the network: the extract, planetiler's own auxiliary sources, and the
 * jar the run is about to execute. Each one is driven with an injected dependency, so no test
 * needs a mirror, a download or a JDK.
 */
describe('the steps that fetch and verify sources', () => {
  function scratchPlan(root: string): BuildPlan {
    return plan({ workDir: join(root, 'basemaps'), cacheDir: root });
  }

  it('downloads the extract through the OSM PBF check and reports a refused transfer', async () => {
    const built = plan();
    const step = stepOf(built, 'fetch-osm');
    const seen: DownloadOptions[] = [];

    const outcome = await createExecutor({
      log: () => {},
      download: async (options) => {
        seen.push(options);
        return { ok: true, bytes: 1024, resumedFrom: 0, attempts: 1, cached: false };
      },
    })(step, { plan: built, elapsedMs: {} });

    expect(outcome.exitCode).toBe(0);
    expect(seen[0]?.url).toBe(
      'https://download.geofabrik.de/south-america/argentina-latest.osm.pbf',
    );
    expect(seen[0]?.destination).toBe(step.destination);
    // The verifier is the download's own gate: nothing reaches the tiler unopened.
    expect(seen[0]?.verify).toBe(osmPbfProblem);

    const refused = await createExecutor({
      log: () => {},
      download: async () => ({
        ok: false,
        bytes: 3,
        resumedFrom: 0,
        attempts: 3,
        cached: false,
        message: 'the transfer stalled at 3 bytes',
      }),
    })(step, { plan: built, elapsedMs: {} });

    expect(refused.exitCode).not.toBe(0);
    expect(refused.message).toContain('the transfer stalled');
    expect(refused.message).toContain(step.url);
  });

  it('retries the source download after a stall instead of waiting on it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-sources-'));
    try {
      const built = scratchPlan(root);
      const step = stepOf(built, 'download-sources');
      mkdirSync(step.jarDir, { recursive: true });
      writeJar(join(step.jarDir, 'profile-with-deps.jar'));

      const attempts: Command[] = [];
      const logs: string[] = [];
      const guard = async (command: Command) => {
        attempts.push(command);
        return attempts.length === 1
          ? { exitCode: 137, stalled: true }
          : { exitCode: 0, stalled: false };
      };

      const outcome = await createExecutor({ log: (line) => logs.push(line), guard })(step, {
        plan: built,
        elapsedMs: {},
      });

      expect(outcome.exitCode).toBe(0);
      expect(attempts).toHaveLength(2);
      expect(attempts[0]?.args).toContain('--only-download');
      expect(logs.join('\n')).toContain('stall');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('gives up on a source download that keeps stalling, naming the stall', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-sources-'));
    try {
      const built = scratchPlan(root);
      const step = stepOf(built, 'download-sources');
      mkdirSync(step.jarDir, { recursive: true });
      writeJar(join(step.jarDir, 'profile-with-deps.jar'));

      const outcome = await createExecutor({
        log: () => {},
        guard: async () => ({ exitCode: 137, stalled: true }),
      })(step, { plan: built, elapsedMs: {} });

      expect(outcome.exitCode).not.toBe(0);
      expect(outcome.message).toContain('stalled 3 times');
      expect(outcome.message).toContain(step.cwd);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes a sources directory whose artefacts open, and names the one that does not', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-sources-'));
    try {
      const built = scratchPlan(root);
      const step = stepOf(built, 'verify-sources');
      const executor = createExecutor({ log: () => {} });

      mkdirSync(step.sourcesDir, { recursive: true });
      writeFileSync(step.osmPath, osmPbfHeader());
      writeFileSync(join(step.sourcesDir, 'land-polygons-split-3857.zip'), storedZip('land.shp'));

      expect((await executor(step, { plan: built, elapsedMs: {} })).exitCode).toBe(0);

      writeFileSync(join(step.sourcesDir, 'water-polygons-split-3857.zip'), 'Not Found');
      const broken = await executor(step, { plan: built, elapsedMs: {} });

      expect(broken.exitCode).not.toBe(0);
      expect(broken.message).toContain('water-polygons-split-3857.zip');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a sources directory that holds no extract, and one that holds nothing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-sources-'));
    try {
      const built = scratchPlan(root);
      const step = stepOf(built, 'verify-sources');
      const executor = createExecutor({ log: () => {} });

      mkdirSync(step.sourcesDir, { recursive: true });
      writeFileSync(join(step.sourcesDir, 'land-polygons-split-3857.zip'), storedZip('land.shp'));
      const noExtract = await executor(step, { plan: built, elapsedMs: {} });
      expect(noExtract.exitCode).not.toBe(0);
      expect(noExtract.message).toContain(step.osmPath);

      rmSync(step.sourcesDir, { recursive: true, force: true });
      const missing = await executor(step, { plan: built, elapsedMs: {} });
      expect(missing.exitCode).not.toBe(0);
      expect(missing.message).toContain(`${step.sourcesDir} does not exist`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses to run a jar that is not a JAR, before spawning java', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-sources-'));
    try {
      const built = scratchPlan(root);
      const step = stepOf(built, 'run-tiler');
      mkdirSync(step.jarDir, { recursive: true });
      // A structurally valid zip that is not a JAR: it opens, and it still cannot be run.
      writeFileSync(join(step.jarDir, 'profile-with-deps.jar'), storedZip('Basemap.class'));

      let spawned = 0;
      const outcome = await createExecutor({
        log: () => {},
        run: async () => {
          spawned += 1;
          return { exitCode: 0 };
        },
        readVectorLayers: () => ['landuse', 'buildings', 'pois'],
        sizeOf: () => 1,
      })(step, { plan: built, elapsedMs: {} });

      expect(outcome.exitCode).not.toBe(0);
      expect(outcome.message).toContain('META-INF/MANIFEST.MF');
      expect(spawned).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * The reset is the step that makes a warm cache build what a cold one would. When it fails the
 * tree is not the pin, and patching it anyway is how a half-applied profile gets compiled: the
 * run has to stop there, and the review of the build entry point asked for this to be pinned.
 */
describe('a failed reset', () => {
  it('stops the run at the reset step, before any patch or the jar', async () => {
    const { steps, executor } = recorder('reset ');
    const result = await run({}, executor);

    expect(result.ok).toBe(false);
    expect(result.step?.kind).toBe('reset-checkout');
    expect(result.exitCode).toBe(7);
    expect(result.message).toContain('step "reset ');
    expect(steps.map((step) => step.kind)).toEqual(['read-pin', 'sync-upstream', 'reset-checkout']);
    expect(steps.some((step) => step.kind === 'apply-patch')).toBe(false);
    expect(steps.some((step) => step.kind === 'build-jar')).toBe(false);
    expect(steps.some((step) => step.kind === 'run-tiler')).toBe(false);
  });

  it('leaves the dirty checkout untouched and names the git command that failed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-reset-failure-'));
    try {
      const workDir = join(root, 'basemaps');
      const commit = checkoutLeftByPreviousRun(workDir);
      const deps = planDeps({ readFile: () => pinAt(commit) });

      const commands: Command[] = [];
      const executor = createExecutor({
        log: () => {},
        run: async (command) => {
          commands.push(command);
          if (command.file === 'git' && command.args.includes('reset')) {
            return { exitCode: 1, error: 'fatal: could not reset the tree' };
          }
          return { exitCode: 0 };
        },
      });

      const result = await run(
        { workDir, cacheDir: join(root, 'cache') },
        executor,
        TOOLCHAIN,
        deps,
      );

      expect(result.ok).toBe(false);
      expect(result.step?.kind).toBe('reset-checkout');
      expect(result.message).toContain(`resetting the checkout at ${workDir}`);
      expect(result.message).toContain('git reset');
      expect(result.message).toContain('fatal: could not reset the tree');

      // Nothing runs after the command that failed, and the previous run's leftovers are still
      // in the tree: the point is to stop, not to clean up halfway.
      expect(commands.filter((command) => command.args.includes('clean'))).toHaveLength(0);
      expect(commands.filter((command) => command.args.includes('apply'))).toHaveLength(0);
      expect(commands.some((command) => command.file === 'mvn')).toBe(false);
      expect(existsSync(join(workDir, 'leftover.txt'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('parseArgs', () => {
  it('rejects an empty --maxzoom= by name instead of building z0', async () => {
    const { error, steps } = await runArgv(['--region=calamuchita', '--maxzoom=']);

    expect(steps).toHaveLength(0);
    expect(error).toMatch(/--maxzoom/);
    // `Number('')` is 0, which is a zoom the profile emits: it would build a useless z0 archive.
    expect(() => parseArgs(['--region=calamuchita', '--maxzoom=  '])).toThrow(/--maxzoom/);
  });

  it('rejects an empty --cache= by name instead of resolving it to the process cwd', async () => {
    const { error, steps } = await runArgv(['--region=calamuchita', '--cache=']);

    expect(steps).toHaveLength(0);
    expect(error).toMatch(/--cache/);
    // `resolve('')` is the process cwd, where the reset step would then run `git clean -fdx`.
    expect(error).not.toContain(process.cwd());
  });

  it('keeps the documented defaults when the optional flags are absent', () => {
    const defaults = parseArgs(['--region=calamuchita']);
    expect(defaults.maxzoom).toBe(DEFAULT_MAXZOOM);
    expect(defaults.cacheDir).toBe(resolve(DEFAULT_CACHE_DIR));
    expect(defaults.workDir).toBe(join(resolve(DEFAULT_CACHE_DIR), 'basemaps'));

    const explicit = parseArgs(['--region=calamuchita', '--maxzoom=15', '--cache=/var/tmp/keep']);
    expect(explicit.maxzoom).toBe(15);
    expect(explicit.cacheDir).toBe('/var/tmp/keep');
    expect(explicit.workDir).toBe('/var/tmp/keep/basemaps');
  });
});

describe('probeToolchain', () => {
  it('asks the java the tiler runs, so a stale JAVA_HOME stops the run before it starts', () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-java-'));
    const previousHome = process.env.JAVA_HOME;
    try {
      // JAVA_HOME points at a directory with no bin/java: a stale setting. The tiler would run
      // `$JAVA_HOME/bin/java` and fail, so the preflight has to say the same thing.
      const javaHome = join(root, 'stale-jdk');
      mkdirSync(join(javaHome, 'bin'), { recursive: true });
      process.env.JAVA_HOME = javaHome;

      const probe = probeToolchain();

      expect(probe.javaMajor).toBeNull();
      // A second candidate on PATH is what made a stale JAVA_HOME pass here and fail later.
      expect(probe.javaLookedFor).not.toContain('PATH');
      const problem = toolchainProblem(probe);
      if (problem === null) throw new Error('a stale JAVA_HOME was not reported');
      expect(problem).toContain('JDK 21');
      expect(problem).toContain('JAVA_HOME/bin/java');
    } finally {
      if (previousHome === undefined) delete process.env.JAVA_HOME;
      else process.env.JAVA_HOME = previousHome;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('asks the same executable the tiler step runs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'map-tiles-java-'));
    const previousHome = process.env.JAVA_HOME;
    try {
      const javaHome = join(root, 'jdk');
      const calls = join(root, 'java-calls.log');
      fakeJava(join(javaHome, 'bin', 'java'), calls, 'openjdk version "21.0.2"');
      process.env.JAVA_HOME = javaHome;

      const probe = probeToolchain();
      expect(probe.javaMajor).toBe(21);

      const options = { ...OPTIONS, workDir: join(root, 'basemaps'), cacheDir: root };
      const built = planBuild(options, planDeps());
      const tilerStep = built.steps.find(
        (step): step is Extract<BuildStep, { kind: 'run-tiler' }> => step.kind === 'run-tiler',
      );
      if (tilerStep === undefined) throw new Error('the plan has no tiler step');
      mkdirSync(tilerStep.jarDir, { recursive: true });
      writeJar(join(tilerStep.jarDir, 'x-with-deps.jar'));

      const outcome = await createExecutor({
        log: () => {},
        readVectorLayers: () => ['landuse'],
        sizeOf: () => 1,
      })(tilerStep, { plan: built, elapsedMs: {} });

      expect(outcome.exitCode).toBe(0);
      // One `-version` from the probe, one `-jar` from the tiler: both the same executable.
      const invoked = readFileSync(calls, 'utf8').trim().split('\n');
      expect(invoked).toHaveLength(2);
      expect(invoked[0]).toBe('-version');
      expect(invoked[1]).toContain('-jar');
    } finally {
      if (previousHome === undefined) delete process.env.JAVA_HOME;
      else process.env.JAVA_HOME = previousHome;
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('missingEnrichedLayers', () => {
  it('names the patch that should have added each missing layer', () => {
    expect(missingEnrichedLayers(['landcover', 'roads'], PATCH_NAMES)).toEqual([
      { layer: 'landuse', patch: '0001-landuse-keeps-its-name.patch' },
      { layer: 'buildings', patch: '0002-buildings-name-and-z16.patch' },
      { layer: 'pois', patch: '0003-pois-reaches-z16.patch' },
    ]);
  });

  it('warns about nothing when the patched layers are all present', () => {
    expect(missingEnrichedLayers(['landuse', 'buildings', 'pois'], PATCH_NAMES)).toEqual([]);
  });
});
