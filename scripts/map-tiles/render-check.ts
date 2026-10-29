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
 * No network. The style names the reserved origin (`map-assets.invalid`), so MapLibre cannot
 * fetch glyphs and falls back to drawing codepoints locally; label *placement* is what this
 * check asserts, and it happens either way.
 *
 * Usage:
 *   bun scripts/map-tiles/render-check.ts --archive=<region>.pmtiles [--expect="Bosque Umepay"]
 *
 * Exit code 0 means the style drew at least one named area and, when `--expect` is given, that
 * every expected name was among them. It also proves the selector's promise: hiding the
 * `green` family (`landuse_*`) removes those labels.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

/**
 * The bit of Bun this script uses, declared here instead of pulling `@types/bun` into the whole
 * `scripts/` typecheck for one call.
 */
declare const Bun: {
  serve(options: { port: number; fetch: (request: Request) => Response | Promise<Response> }): {
    port: number;
    stop(force?: boolean): void;
  };
};

export interface RenderCheckOptions {
  archive: string;
  style: string;
  /** `z/x/y` of the tile the check renders, or `null` for the archive's centre. */
  tile: { z: number; x: number; y: number };
  /** Names that must appear among the labels the style placed. */
  expect: string[];
  /** Style layers whose visibility proves the selector works. */
  family: string;
}

/** The lon/lat of the centre of one slippy tile, in the order MapLibre wants it. */
export function tileCenter(z: number, x: number, y: number): [number, number] {
  const lon = ((x + 0.5) / 2 ** z) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / 2 ** z))) * 180) / Math.PI;
  return [lon, lat];
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
function ranged(path: string) {
  return (request: Request): Response => {
    const range = request.headers.get('range');
    if (range === null) return bytes(path);
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match === null) return bytes(path);

    const buffer = readFileSync(path);
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
  /** The style-layer prefix the check watched, echoed so the output names what it tested. */
  family: string;
  /** The names the style placed on its label layer. */
  names: string[];
  /** How many style layers the family owns, so a missing one is visible in the output. */
  familyLayers: number;
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
      family: options.family,
      names: [],
      familyLayers: 0,
      sourceLoaded: false,
      message: 'maplibre-gl and pmtiles must be installed to render an archive',
    };
  }

  const style = JSON.parse(readFileSync(options.style, 'utf8')) as Record<string, unknown>;
  const [lon, lat] = tileCenter(options.tile.z, options.tile.x, options.tile.y);

  const server = Bun.serve({
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
        return ranged(options.archive)(request);
      }
      if (url.pathname === '/style.json') {
        const served = structuredClone(style);
        served.sources = {
          basemap: {
            type: 'vector',
            url: `pmtiles://http://127.0.0.1:${server.port}/archive.pmtiles`,
          },
        };
        // The reserved origin keeps this check offline: MapLibre cannot fetch glyphs and draws
        // codepoints locally, which is enough to prove a label was placed.
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

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM;
  const browser = await chromium.launch({
    ...(executablePath === undefined ? {} : { executablePath }),
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  try {
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
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('the map never went idle')), 60_000);
          map.on('idle', () => {
            clearTimeout(timer);
            resolve();
          });
        });

        const familyLayers: string[] = map
          .getStyle()
          .layers.map((layer: { id: string }) => layer.id)
          .filter((id: string) => id.startsWith(input.family));
        const labelLayers = familyLayers.filter((id) =>
          map
            .getStyle()
            .layers.some(
              (layer: { id: string; type?: string }) => layer.id === id && layer.type === 'symbol',
            ),
        );

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

        const before = placed(labelLayers);
        // The selector's promise: hiding the family hides its labels too.
        for (const id of familyLayers) map.setLayoutProperty(id, 'visibility', 'none');
        await new Promise((resolve) => setTimeout(resolve, 250));
        const after = placed(labelLayers);
        for (const id of familyLayers) map.setLayoutProperty(id, 'visibility', 'visible');

        return {
          names: before,
          afterHiding: after,
          familyLayers: familyLayers.length,
          labelLayers: labelLayers.length,
          sourceLoaded: map.isSourceLoaded('basemap'),
        };
      },
      { center: [lon, lat], zoom: options.tile.z, family: options.family },
    );

    const missing = options.expect.filter((name) => !rendered.names.includes(name));
    const problems: string[] = [];
    if (!rendered.sourceLoaded) problems.push('the archive never loaded as a source');
    if (rendered.labelLayers === 0) {
      problems.push(`the style has no symbol layer in the "${options.family}" family`);
    }
    if (rendered.names.length === 0) problems.push('the style placed no named label');
    if (missing.length > 0) problems.push(`not drawn: ${missing.join(', ')}`);
    if (rendered.afterHiding.length > 0) {
      problems.push(`hiding "${options.family}" left ${rendered.afterHiding.join(', ')} drawn`);
    }

    return {
      ok: problems.length === 0,
      family: options.family,
      names: rendered.names,
      familyLayers: rendered.familyLayers,
      sourceLoaded: rendered.sourceLoaded,
      ...(problems.length === 0 ? {} : { message: problems.join('; ') }),
    };
  } finally {
    await browser.close();
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

async function main(argv: string[]): Promise<number> {
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

  const result = await renderCheck(
    {
      archive: resolve(archive),
      style: resolve(flag(argv, 'style') ?? join(repoRoot, 'assets/map/styles/v1.json')),
      tile: { z: parts[0] as number, x: parts[1] as number, y: parts[2] as number },
      expect: (flag(argv, 'expect') ?? '').split(',').filter((name) => name.length > 0),
      family: flag(argv, 'family') ?? 'landuse',
    },
    repoRoot,
  );

  console.log(
    `source loaded: ${result.sourceLoaded} | ${result.family} layers: ${result.familyLayers}`,
  );
  console.log(`labels placed: ${result.names.length === 0 ? '(none)' : result.names.join(', ')}`);
  if (!result.ok) {
    console.error(`map-tiles-render-check: ${result.message ?? 'the check failed'}`);
    return 1;
  }
  return 0;
}

const invoked = process.argv[1];
if (invoked !== undefined && resolve(invoked) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
