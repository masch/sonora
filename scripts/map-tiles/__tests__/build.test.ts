import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { MAP_REGIONS, bboxTuple } from '../../../packages/shared/src/map/regions';
import {
  DEFAULT_MAXZOOM,
  type BuildOptions,
  type BuildPlan,
  type BuildStep,
  type StepExecutor,
  type ToolchainProbe,
  missingEnrichedLayers,
  planBuild,
  runBuild,
  tilerArgs,
  toolchainProblem,
} from '../build';

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
function planDeps(overrides: { readFile?: () => string; listDir?: () => string[] } = {}) {
  return {
    readFile: overrides.readFile ?? (() => PIN),
    listDir: overrides.listDir ?? (() => [...PATCH_NAMES]),
  };
}

function plan(overrides: Partial<BuildOptions> = {}, deps = planDeps()): BuildPlan {
  return planBuild({ ...OPTIONS, ...overrides }, deps);
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
) {
  return runBuild(
    { ...OPTIONS, ...options },
    {
      ...planDeps(),
      executor,
      probeToolchain: () => probe,
      now: () => 0,
      log: () => {},
    },
  );
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

  it('plans read-pin, the pinned checkout, every patch in filename order, the jar, the tiler and the report', () => {
    const steps = plan().steps;
    expect(steps.map((step) => step.kind)).toEqual([
      'read-pin',
      'sync-upstream',
      'apply-patch',
      'apply-patch',
      'apply-patch',
      'build-jar',
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
    expect(args).toContain(`--data-dir=${step.dataDir}`);
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
      'apply-patch',
      'apply-patch',
      'apply-patch',
      'build-jar',
      'run-tiler',
      'report',
    ]);
    expect(new Set(steps.map((step) => step.label)).size).toBe(steps.length);
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
