/**
 * The parts of the render check that need no browser: the tile geometry, the selector's hide set
 * and where a package really lives. The render itself is the check's own output — a browser is
 * not something a unit test should depend on.
 */
import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RENDER_HOST, hiddenLayersFor, packageDir, tileCenter } from '../render-check';

describe('the render server address', () => {
  it('is loopback, so the archive is not served to the network', () => {
    // Pinned rather than inherited: `Bun.serve` takes its default from the runtime version, and
    // this process serves a built archive and the MapLibre assets to a page it opens itself.
    expect(RENDER_HOST).toBe('127.0.0.1');
  });
});

describe('tileCenter', () => {
  it('puts z0/0/0 at the centre of the world', () => {
    const [lon, lat] = tileCenter(0, 0, 0);
    expect(lon).toBe(0);
    expect(lat).toBeCloseTo(0, 6);
  });

  it('lands inside the Calamuchita bbox for the tile the check renders', () => {
    // The tile the archive scan found the area names in. If this math drifts, the check would
    // render an empty piece of the world and report "no label" for a working style.
    const [lon, lat] = tileCenter(15, 10491, 19483);
    expect(lon).toBeGreaterThan(-64.83);
    expect(lon).toBeLessThan(-64.66);
    expect(lat).toBeGreaterThan(-32.28);
    expect(lat).toBeLessThan(-32.12);
  });

  it('inverts y, because a tile row grows southwards', () => {
    const [, north] = tileCenter(10, 512, 300);
    const [, south] = tileCenter(10, 512, 301);
    expect(north).toBeGreaterThan(south);
  });
});

/**
 * The command line as somebody else calls it: `make map-tiles-render-check ARCHIVE=` passes an
 * empty value, and what comes back must be one line naming the flag — not the runtime's stack
 * trace, which is what an unhandled rejection produces and what a reader cannot act on.
 */
describe('the command line reports a bad argument as an argument error', () => {
  const script = fileURLToPath(new URL('../render-check.ts', import.meta.url));

  for (const argv of [['--archive='], ['--archive']]) {
    it(`rejects ${argv.join(' ')} with one line and no stack trace`, () => {
      const run = spawnSync(process.execPath, [script, ...argv], { encoding: 'utf8' });

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('map-tiles-render-check: --archive needs a value');
      // A frame (`    at ...`) is the unhandled-rejection dump, and the runtime banner
      // (`Bun v…`) with it: both mean the error escaped instead of being reported.
      expect(run.stderr).not.toMatch(/^\s+at /m);
      expect(run.stderr).not.toContain('Bun v');
    });
  }

  // A flag nobody reads used to be ignored, so a renamed one fell through to the default group and
  // the check could pass while watching different layers. Both shapes now fail, naming the flag.
  for (const [argv, expected] of [
    [['--archive=/nonexistent.pmtiles', '--family=landuse'], '--family is now --group'],
    [['--archive=/nonexistent.pmtiles', '--nonsense=1'], 'unknown option --nonsense'],
    // `--region` used to pick the expectations out of a data file; they live in the integration
    // test now, so keeping the flag would be a second name that does nothing.
    [['--archive=/nonexistent.pmtiles', '--region=calamuchita'], 'unknown option --region'],
  ] as [string[], string][]) {
    it(`refuses ${argv[1]} instead of ignoring it`, () => {
      const run = spawnSync(process.execPath, [script, ...argv], { encoding: 'utf8' });

      expect(run.status).toBe(1);
      expect(run.stderr).toContain(expected);
      expect(run.stderr).not.toMatch(/^\s+at /m);
    });
  }
});

describe('the selector hide set', () => {
  // The style the archive check renders with, read the way the check reads it: what the group
  // table resolves is what the render hides, so this is the input the assertion depends on.
  const style = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../assets/map/styles/v1.json', import.meta.url)),
      'utf8',
    ),
  ) as { layers: { id: string; type: string }[] };
  const ids = style.layers.map((layer) => layer.id);

  it('resolves `green` to exactly the landuse_* layers the style draws', () => {
    // Two independent derivations: the prefix the group table declares, and the ids themselves.
    // A group that stops claiming its family makes the render check hide nothing and "prove" the
    // selector by leaving every label drawn, which is the defect this comparison exists to catch.
    expect(hiddenLayersFor(ids, 'green')).toEqual(ids.filter((id) => id.startsWith('landuse_')));
  });

  it('includes the label layer, so hiding the group can take a name with it', () => {
    const hidden = hiddenLayersFor(ids, 'green');
    expect(hidden).toContain('landuse_label');
    expect(style.layers.find((layer) => layer.id === 'landuse_label')?.type).toBe('symbol');
  });

  it('never hides the canvas, which every client draws whatever it asks for', () => {
    const hidden = hiddenLayersFor(ids, 'green');
    for (const alwaysOn of ['background', 'earth', 'earth_label_islands', 'landcover_wood']) {
      expect(hidden).not.toContain(alwaysOn);
    }
  });
});

describe('packageDir', () => {
  it('finds a hoisted package', () => {
    const root = mkdtempSync(join(tmpdir(), 'render-check-'));
    try {
      mkdirSync(join(root, 'node_modules', 'hoisted'), { recursive: true });
      writeFileSync(join(root, 'node_modules', 'hoisted', 'package.json'), '{}');
      expect(packageDir(root, 'hoisted')).toBe(join(root, 'node_modules', 'hoisted'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('finds one bun kept isolated under .bun, and says so when it is absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'render-check-'));
    try {
      const isolated = join(
        root,
        'node_modules',
        '.bun',
        'pmtiles@4.5.0',
        'node_modules',
        'pmtiles',
      );
      mkdirSync(isolated, { recursive: true });
      writeFileSync(join(isolated, 'package.json'), '{}');

      expect(packageDir(root, 'pmtiles')).toBe(isolated);
      expect(packageDir(root, 'not-installed')).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * The integration test's contract with a CI job, checked from outside it.
 *
 * A render suite that skips is honest on a laptop and worthless in CI: the job goes green having
 * rendered nothing. `render.test.ts` therefore treats a missing archive or browser as a failure
 * wherever `CI` says the render is required, and this runs it the way CI would.
 */
describe('the integration test in CI', () => {
  const integration = fileURLToPath(new URL('./render.test.ts', import.meta.url));

  it('fails instead of skipping when CI asks for the render and the archive is missing', () => {
    const run = spawnSync(process.execPath, ['test', integration], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: 'true',
        MAP_TILES_ARCHIVE: '/nonexistent/calamuchita.pmtiles',
        PLAYWRIGHT_CHROMIUM: '/nonexistent/chrome',
      },
    });

    expect(run.status).not.toBe(0);
    expect(`${run.stdout}${run.stderr}`).toContain('the render check cannot run');
  });

  it('still skips on a laptop, so the suite is usable without a build', () => {
    const run = spawnSync(process.execPath, ['test', integration], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: '',
        MAP_TILES_ARCHIVE: '/nonexistent/calamuchita.pmtiles',
        PLAYWRIGHT_CHROMIUM: '/nonexistent/chrome',
      },
    });

    expect(run.status).toBe(0);
    expect(`${run.stdout}${run.stderr}`).toContain('render check skipped');
  });
});
