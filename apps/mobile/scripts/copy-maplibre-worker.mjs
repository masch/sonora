/**
 * Publishes MapLibre's web worker as a static asset.
 *
 * MapLibre runs in a Web Worker, and the metro web build does not emit that
 * worker: the app asks for a chunk that does not exist, the host answers the SPA
 * fallback as text/html, and the map dies with "Worker failed to load". Copying the
 * file the package ships into `public/` puts it in the export as a real asset, and
 * `setWorkerUrl` in the map component points at it.
 *
 * The copy is written with a `.js` extension on purpose: an ES module worker does not
 * care about the extension, and `.mjs` is the extension hosts most often serve as
 * `text/html` or `application/octet-stream`. The file is generated, not committed, so
 * it can never drift away from the pinned package version.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_NAME = 'maplibre-gl-worker.mjs';
const TARGET_DIRECTORY = path.join(PACKAGE_ROOT, 'public');
const TARGET_NAME = 'maplibre-gl-worker.js';

const require = createRequire(import.meta.url);
const packageJson = require.resolve('maplibre-gl/package.json');
const source = path.join(path.dirname(packageJson), 'dist', SOURCE_NAME);

if (!existsSync(source)) {
  console.error(`✘ MapLibre worker not found at ${source}`);
  process.exit(1);
}

mkdirSync(TARGET_DIRECTORY, { recursive: true });
const target = path.join(TARGET_DIRECTORY, TARGET_NAME);
copyFileSync(source, target);

const { size } = statSync(target);
if (size === 0) {
  console.error('✘ The MapLibre worker copy is empty');
  process.exit(1);
}

console.log(`✓ ${TARGET_NAME} published (${Math.round(size / 1024)} KB)`);
