/**
 * The parts of the render check that need no browser: the tile geometry and where a package
 * really lives. The render itself is the check's own output — a browser is not something a unit
 * test should depend on.
 */
import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { packageDir, tileCenter } from '../render-check';

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
