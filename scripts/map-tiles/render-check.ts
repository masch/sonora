/**
 * scripts/map-tiles/render-check.ts — does the style we publish actually draw what the
 * archive we built carries?
 *
 * A device answers that question in twenty seconds and is the only place the native plumbing
 * (the `pmtiles://file://` protocol, the font ranges on disk, the per-session style cache) can
 * be exercised. But the *other* half — the style's filters, its zoom ranges, the font a layer
 * asks for — can be answered without a phone, and this is it: headless Chromium renders the
 * built archive with the repository's style and reports the labels the style actually placed.
 *
 * No network. The style names the reserved origin (`map-assets.invalid`), so no glyph range
 * resolves; MapLibre answers that on its own by drawing the codepoints locally, and the label is
 * still placed. That fallback is the renderer's, not this script's — what the check asserts is
 * placement, which is what a filter, a zoom range or a font stack can break.
 *
 * Usage:
 *   bun scripts/map-tiles/render-check.ts --archive=<region>.pmtiles [--expect="Bosque Umepay"]
 *
 * With neither `--expect` nor `--expect-fill` the check invents no name: it reports what the
 * style drew and asserts only what any archive must show — the source loaded, the `green` group
 * resolves to at least one layer, at least one named label was placed, and hiding the group
 * removes it. What the tiles are *expected* to draw lives in the integration test that drives
 * this renderer, `__tests__/render.test.ts`, so a label that stops being placed fails
 * `bun test` naming the tile that lost it. The two flags are how a one-off names its own.
 *
 * Exit code 0 means the style drew at least one named area, that every name `--expect` gives was
 * among them, and that every layer `--expect-fill` names drew a feature. It also measures the
 * layer selector: it hides exactly the layers `layerIdsForGroup` assigns to the `green` group —
 * the same resolution the web selector runs — and fails if the label it drew is still there.
 * What that proves is the group table and MapLibre's answer to it; what wires a group to the
 * control is a component, and there it is `experience-map-web.test.tsx`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

// The selector's own resolution, imported by path for the reason `map-assets.ts` states:
// `@sonora/shared` is not linked into the repository root. Using it here is what makes the
// selector half of this check measure production's rules instead of a copy of them.
import {
  MAP_LAYER_GROUPS,
  layerIdsForGroup,
  type MapLayerGroupId,
} from '../../packages/shared/src/map/layer-groups';

/**
 * The bit of Bun this script uses, declared here instead of pulling `@types/bun` into the whole
 * `scripts/` typecheck for one call.
 */
declare const Bun: {
  serve(options: {
    port: number;
    /** Loopback: this process loads the page, so nobody else needs the socket. */
    hostname?: string;
    fetch: (request: Request) => Response | Promise<Response>;
  }): {
    port: number;
    stop(force?: boolean): void;
  };
};

/**
 * The address the check serves on.
 *
 * Loopback on purpose: the archive, the style and the MapLibre assets are this process's own
 * files and only the page it opens reads them. `Bun.serve`'s default is inherited from whatever
 * the runtime version decides (`localhost` today, documented as `0.0.0.0`), so the address is
 * named here instead of left to it.
 */
export const RENDER_HOST = '127.0.0.1';

export interface RenderCheckOptions {
  archive: string;
  style: string;
  /** `z/x/y` of the tile the check renders, or `null` for the archive's centre. */
  tile: { z: number; x: number; y: number };
  /** Names that must appear among the labels the style placed. */
  expect: string[];
  /** Style layers that must draw at least one feature, so a missing fill fails here too. */
  expectFills: string[];
  /** The selector group whose visibility this check measures. */
  group: MapLayerGroupId;
}

/**
 * The style layers the selector hides for one group.
 *
 * Delegated to `@sonora/shared` instead of re-derived here: the check's subject is the group table
 * the app ships, so a prefix that stops claiming a layer has to fail this check the way it would
 * fail the selector. A local `startsWith` agrees with itself and proves nothing.
 */
export function hiddenLayersFor(layers: Iterable<string>, group: MapLayerGroupId): string[] {
  return layerIdsForGroup(layers, group);
}

/** The lon/lat of the centre of one slippy tile, in the order MapLibre wants it. */
export function tileCenter(z: number, x: number, y: number): [number, number] {
  const lon = ((x + 0.5) / 2 ** z) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / 2 ** z))) * 180) / Math.PI;
  return [lon, lat];
}

/**
 * An already installed Playwright Chromium, newest first, or `null`.
 *
 * The check never downloads one: a test that silently fetches 150 MB is not something a suite
 * should do, and a machine without a browser should skip the render, visibly, instead.
 */
export function findChromium(cacheDir?: string): string | null {
  const root = cacheDir ?? join(process.env.HOME ?? '', '.cache', 'ms-playwright');
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return null;
  }

  const candidates = entries
    .filter((entry) => entry.startsWith('chromium-'))
    .sort((a, b) => Number(b.split('-')[1] ?? 0) - Number(a.split('-')[1] ?? 0));

  for (const entry of candidates) {
    for (const relative of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const path = join(root, entry, relative);
      if (existsSync(path)) return path;
    }
  }
  return null;
}

/** Where a package really lives, whether it is hoisted or bun's isolated `.bun/` layout. */
export function packageDir(repoRoot: string, name: string): string | null {
  const hoisted = join(repoRoot, 'node_modules', name);
  if (existsSync(join(hoisted, 'package.json'))) return hoisted;

  const isolated = join(repoRoot, 'node_modules', '.bun');
  try {
    const match = readdirSync(isolated)
      .filter((entry) => entry === name || entry.startsWith(`${name}@`))
      .sort()
      .pop();
    if (match === undefined) return null;
    const candidate = join(isolated, match, 'node_modules', name);
    return existsSync(join(candidate, 'package.json')) ? candidate : null;
  } catch {
    return null;
  }
}

const MIME: Record<string, string> = {
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.pbf': 'application/x-protobuf',
  '.png': 'image/png',
};

/** The page: a canvas, the UMD `pmtiles` bundle, and MapLibre as an ES module. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/maplibre/maplibre-gl.css">
<style>html,body,#map{margin:0;height:100%;width:100%}</style>
</head><body><div id="map"></div>
<script src="/pmtiles.js"></script>
<script type="module">
import * as maplibregl from '/maplibre/maplibre-gl.mjs';
window.maplibregl = maplibregl;
window.ready = true;
</script></body></html>`;

function bytes(path: string): Response {
  const type = MIME[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream';
  const buffer = readFileSync(path);
  return new Response(buffer, {
    headers: {
      'content-type': type,
      'content-length': String(buffer.length),
      'accept-ranges': 'bytes',
      'access-control-allow-origin': '*',
    },
  });
}

/** A file served with byte ranges, which is what the `pmtiles` protocol asks for. */
function ranged(buffer: Buffer) {
  return (request: Request): Response => {
    const range = request.headers.get('range');
    if (range === null) {
      return new Response(buffer, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(buffer.length),
          'accept-ranges': 'bytes',
          'access-control-allow-origin': '*',
        },
      });
    }
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match === null) return bytes('');

    const start = Number(match[1]);
    const end = match[2] === '' ? buffer.length - 1 : Number(match[2]);
    return new Response(buffer.subarray(start, end + 1), {
      status: 206,
      headers: {
        'content-type': 'application/octet-stream',
        'content-range': `bytes ${start}-${end}/${buffer.length}`,
        'content-length': String(end - start + 1),
        'accept-ranges': 'bytes',
        'access-control-allow-origin': '*',
      },
    });
  };
}

export interface RenderCheckResult {
  ok: boolean;
  /** The selector group the check watched, echoed so the output names what it tested. */
  group: MapLayerGroupId;
  /** The names the style placed on its label layer. */
  names: string[];
  /** The fill layers that drew at least one feature. */
  fills: string[];
  /** How many style layers the group owns, so a group that claims nothing is visible. */
  groupLayers: number;
  /** Whether the source reported itself loaded, which separates "empty" from "not fetched". */
  sourceLoaded: boolean;
  message?: string;
}

/**
 * Renders one archive with one style and reports what the style drew.
 *
 * The Chromium executable comes from `PLAYWRIGHT_CHROMIUM`, or from the browsers Playwright
 * already installed; this never downloads one, because a check that silently fetches 150 MB is
 * not a check a CI job should run by accident.
 */
export async function renderCheck(
  options: RenderCheckOptions,
  repoRoot: string,
): Promise<RenderCheckResult> {
  const maplibre = packageDir(repoRoot, 'maplibre-gl');
  const pmtiles = packageDir(repoRoot, 'pmtiles');
  if (maplibre === null || pmtiles === null) {
    return {
      ok: false,
      group: options.group,
      names: [],
      fills: [],
      groupLayers: 0,
      sourceLoaded: false,
      message: 'maplibre-gl and pmtiles must be installed to render an archive',
    };
  }

  const style = JSON.parse(readFileSync(options.style, 'utf8')) as Record<string, unknown>;
  const [lon, lat] = tileCenter(options.tile.z, options.tile.x, options.tile.y);
  const hidden = hiddenLayersFor(
    ((style.layers ?? []) as { id: string }[]).map((layer) => layer.id),
    options.group,
  );

  // Read once, served from memory: a `readFileSync` per range request blocked this single-threaded
  // server while the renderer fired several at once, and the tile that lost that race never
  // arrived — the intermittent failure this check kept showing on CI and every eighth run here.
  const serveArchive = ranged(readFileSync(options.archive));

  const server = Bun.serve({
    hostname: RENDER_HOST,
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === '/') {
        return new Response(PAGE, { headers: { 'content-type': 'text/html' } });
      }
      if (url.pathname === '/pmtiles.js') {
        return bytes(join(pmtiles, 'dist', 'pmtiles.js'));
      }
      if (url.pathname === '/archive.pmtiles') {
        return serveArchive(request);
      }
      if (url.pathname === '/style.json') {
        const served = structuredClone(style);
        served.sources = {
          basemap: {
            type: 'vector',
            url: `pmtiles://http://127.0.0.1:${server.port}/archive.pmtiles`,
          },
        };
        // The reserved origin keeps this check offline. The glyphs cannot be fetched, and
        // **MapLibre** falls back on its own: it logs `Rendering codepoint U+0061 locally instead`
        // and places the label with a locally drawn glyph. This check does not provide that
        // fallback, it relies on it — which is why the assertion is about placement, not about
        // pixels.
        return new Response(JSON.stringify(served), {
          headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        });
      }
      if (url.pathname.startsWith('/maplibre/')) {
        return bytes(join(maplibre, 'dist', url.pathname.slice('/maplibre/'.length)));
      }
      return new Response('not found', { status: 404 });
    },
  });

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM ?? findChromium() ?? undefined;
  // Declared before the launch and closed with `?.`: a launch that rejects — no browser on this
  // machine — must not leave the server listening behind it.
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      ...(executablePath === undefined ? {} : { executablePath }),
      args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    });

    const tab = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await tab.goto(`http://127.0.0.1:${server.port}/`);
    await tab.waitForFunction(
      () =>
        (globalThis as { ready?: boolean }).ready === true &&
        typeof (globalThis as { pmtiles?: unknown }).pmtiles === 'object' &&
        typeof (globalThis as { maplibregl?: unknown }).maplibregl === 'object',
      undefined,
      { timeout: 20_000 },
    );

    const rendered = await tab.evaluate(
      async (input) => {
        const lib = (globalThis as Record<string, any>).maplibregl;
        lib.addProtocol('pmtiles', new (globalThis as Record<string, any>).pmtiles.Protocol().tile);

        const map = new lib.Map({
          container: 'map',
          style: '/style.json',
          center: input.center,
          zoom: input.zoom,
          attributionControl: false,
          fadeDuration: 0,
        });
        // The style has to be parsed before `getStyle()` can be read or a layer hidden. The event
        // that says so is `styledata`: MapLibre sets the style's own loaded flag and then fires it,
        // while `isStyleLoaded()` answers something stricter — it also waits for every **source**
        // to finish loading, which for a PMTiles archive means tiles. Waiting on that was the flake:
        // under the load of a whole test suite it ran out of a 20 s deadline on one tile of a run,
        // and the failure read as `the style never finished loading` when nothing was wrong with the
        // style. Bounded, so a style that never parses still says so.
        await new Promise<void>((resolve, reject) => {
          const deadline = setTimeout(
            () => reject(new Error('the style never finished parsing')),
            20_000,
          );
          map.once('styledata', () => {
            clearTimeout(deadline);
            resolve();
          });
        });

        // What the assertions need is the data, not the renderer's opinion about its own
        // bookkeeping. `idle` waited for every request to settle — tiles, fonts and the sprite —
        // and this check serves neither glyph nor sprite, so on a CI runner it timed out on every
        // other tile. `isSourceLoaded` is not a way out either: measured here, one tile in four
        // leaves it false for half a minute while its labels and fills are already drawn. Both are
        // reported below, and neither decides the check: the features do, polled for directly.

        const groupLayers: string[] = map
          .getStyle()
          .layers.map((layer: { id: string }) => layer.id)
          .filter((id: string) => input.hideLayers.includes(id));
        const symbolLayers = new Set<string>(
          map
            .getStyle()
            .layers.filter((layer: { type?: string }) => layer.type === 'symbol')
            .map((layer: { id: string }) => layer.id),
        );
        // Two sets, because two different questions are asked. The names the style draws come from
        // **every** symbol layer — a buildings label is not in the `green` group, and a check that
        // watched only the group it measures could never see one. Hiding the group, on the other
        // hand, must take exactly the group's own labels with it.
        const labelLayers: string[] = [...symbolLayers];
        const groupLabelLayers: string[] = groupLayers.filter((id) => symbolLayers.has(id));

        const placed = (layers: string[]): string[] =>
          layers.length === 0
            ? ([] as string[])
            : [
                ...new Set<string>(
                  map
                    .queryRenderedFeatures({ layers })
                    .map(
                      (feature: { properties?: Record<string, unknown> }) =>
                        feature.properties?.name,
                    )
                    .filter(
                      (name: unknown): name is string =>
                        typeof name === 'string' && name.length > 0,
                    ),
                ),
              ];

        // Symbol placement runs in the renderer's worker and lands a frame or two after the data
        // does, so wait — bounded — for the names this tile promises to be on the map, and let the
        // assertion below report a name that never arrives. A fixed pause measured the scheduler.
        const placeDeadline = Date.now() + 20_000;
        while (
          (input.expect.length === 0 ||
            input.expect.some((name: string) => !placed(labelLayers).includes(name))) &&
          Date.now() < placeDeadline
        ) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          map.triggerRepaint();
        }

        const drawnFills = input.expectFills.filter(
          (id: string) => map.queryRenderedFeatures({ layers: [id] }).length > 0,
        );

        const before = placed(labelLayers);
        // The selector's rule, applied to the set it resolves for this group: hiding the group
        // must take its labels with it. What this cannot say is what the control shows — that is
        // the component's test, and this one is about the group table and the renderer.
        for (const id of groupLayers) map.setLayoutProperty(id, 'visibility', 'none');
        // The renderer answers a layout change on a later frame, not on the next statement, so a
        // fixed pause measured the scheduler. Poll until the labels are gone, bounded.
        const hideDeadline = Date.now() + 5_000;
        let after = placed(groupLabelLayers);
        while (after.length > 0 && Date.now() < hideDeadline) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          map.triggerRepaint();
          after = placed(groupLabelLayers);
        }
        for (const id of groupLayers) map.setLayoutProperty(id, 'visibility', 'visible');

        // Reported, never asserted: it is the renderer's own bookkeeping, and it disagrees with
        // what it drew often enough (see above) that making it a failure would fail good renders.
        const sourceLoaded = map.isSourceLoaded('basemap');

        return {
          names: before,
          drawnFills,
          afterHiding: after,
          groupLayers: groupLayers.length,
          labelLayers: groupLabelLayers.length,
          sourceLoaded,
        };
      },
      {
        center: [lon, lat],
        zoom: options.tile.z,
        hideLayers: hidden,
        expect: options.expect,
        expectFills: options.expectFills,
      },
    );

    const missing = options.expect.filter((name) => !rendered.names.includes(name));
    const missingFills = options.expectFills.filter((id) => !rendered.drawnFills.includes(id));
    const problems: string[] = [];
    // Not a problem on its own: a renderer that drew the expected features has done its job, and
    // the flag is printed by the CLI so a reader can still see what it claimed.
    if (rendered.groupLayers === 0) {
      problems.push(`the selector's "${options.group}" group owns no layer of this style`);
    }
    if (rendered.labelLayers === 0) {
      problems.push(`the style has no symbol layer in the "${options.group}" group`);
    }
    if (rendered.names.length === 0) problems.push('the style placed no named label');
    if (missing.length > 0) problems.push(`not drawn: ${missing.join(', ')}`);
    if (missingFills.length > 0)
      problems.push(`fills that drew nothing: ${missingFills.join(', ')}`);
    if (rendered.afterHiding.length > 0) {
      problems.push(`hiding "${options.group}" left ${rendered.afterHiding.join(', ')} drawn`);
    }

    return {
      ok: problems.length === 0,
      group: options.group,
      names: rendered.names,
      fills: rendered.drawnFills,
      groupLayers: rendered.groupLayers,
      sourceLoaded: rendered.sourceLoaded,
      ...(problems.length === 0 ? {} : { message: problems.join('; ') }),
    };
  } finally {
    await browser?.close();
    server.stop(true);
  }
}

/** `--name=value` or `--name value`, the shape the other scripts in this directory use. */
function flag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const index = argv.indexOf(`--${name}`);
  if (inline === undefined && index === -1) return undefined;
  const value = inline !== undefined ? inline.slice(prefix.length) : argv[index + 1];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`--${name} needs a value, got "${value ?? ''}".`);
  }
  return value;
}

/**
 * Every flag `main` reads. A name outside this list is refused instead of ignored: the selector
 * flag was renamed, and a baseline invocation that still says `--family` would otherwise fall
 * through to the default group and let the check pass while watching other layers.
 */
const KNOWN_FLAGS = ['archive', 'tile', 'expect', 'expect-fill', 'style', 'group'];

function assertKnownFlags(argv: string[]): void {
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2).split('=')[0] ?? '';
    if (KNOWN_FLAGS.includes(name)) continue;
    throw new Error(
      name === 'family'
        ? '--family is now --group (a selector group id), or --expect-fill for a style layer.'
        : `unknown option --${name}; this check reads ${KNOWN_FLAGS.map((each) => `--${each}`).join(', ')}.`,
    );
  }
}

async function main(argv: string[]): Promise<number> {
  assertKnownFlags(argv);

  const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const archive = flag(argv, 'archive');
  if (archive === undefined) {
    console.error(
      'map-tiles-render-check: --archive=<region>.pmtiles is required (build one with `make map-tiles-build`).',
    );
    return 1;
  }

  const tile = flag(argv, 'tile') ?? '15/10491/19483';
  const parts = tile.split('/').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    console.error(`map-tiles-render-check: --tile must be z/x/y, got "${tile}".`);
    return 1;
  }

  // The flags are the only way to make this CLI assert a name or a layer. Nothing is read from
  // disk behind them: what the tiles are expected to draw lives in `__tests__/render.test.ts`,
  // next to the renderer, so an expectation cannot pass by nobody remembering to pass a flag.
  const expect = (flag(argv, 'expect') ?? '').split(',').filter((name) => name.length > 0);
  const expectFills = (flag(argv, 'expect-fill') ?? '').split(',').filter((id) => id.length > 0);

  const group = flag(argv, 'group') ?? 'green';
  if (!(MAP_LAYER_GROUPS as readonly string[]).includes(group)) {
    console.error(
      `map-tiles-render-check: --group must be one of ${MAP_LAYER_GROUPS.join(', ')}, got "${group}".`,
    );
    return 1;
  }

  const result = await renderCheck(
    {
      archive: resolve(archive),
      style: resolve(flag(argv, 'style') ?? join(repoRoot, 'assets/map/styles/v1.json')),
      tile: { z: parts[0] as number, x: parts[1] as number, y: parts[2] as number },
      expect,
      expectFills,
      group: group as MapLayerGroupId,
    },
    repoRoot,
  );

  console.log(
    `source loaded: ${result.sourceLoaded} | "${result.group}" layers: ${result.groupLayers}`,
  );
  console.log(`labels placed: ${result.names.length === 0 ? '(none)' : result.names.join(', ')}`);
  console.log(`fills drawn:   ${result.fills.length === 0 ? '(none)' : result.fills.join(', ')}`);
  if (!result.ok) {
    console.error(`map-tiles-render-check: ${result.message ?? 'the check failed'}`);
    return 1;
  }
  return 0;
}

const invoked = process.argv[1];
if (invoked !== undefined && resolve(invoked) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      // A bad flag is an argument error and reads as one line; anything else keeps its message.
      // Without this the rejection escapes and the runtime prints its own frame-by-frame dump.
      console.error(
        `map-tiles-render-check: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    });
}
