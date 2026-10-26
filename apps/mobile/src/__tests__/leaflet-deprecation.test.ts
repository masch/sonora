import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Leaflet is deprecated and frozen: it keeps working exactly as it is and gets no
 * new features. The ESLint config rejects a new `import ... from 'leaflet'`, but the
 * renderer can also be reached without importing it, by loading its script from a
 * CDN inside a WebView. This test pins both ways of consuming it to the two files
 * that already existed, so "frozen" is a fact a pull request has to break on
 * purpose rather than a note in a document.
 */

const SRC = join(__dirname, '..');

/** The only two modules allowed to reach Leaflet, relative to `src`. */
const FROZEN = ['components/track-detail-map.tsx', 'components/track-detail-map.web.tsx'];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** A file consumes Leaflet when it imports the package or loads its script remotely. */
function consumesLeaflet(path: string): boolean {
  const source = readFileSync(path, 'utf8');
  return /from 'leaflet'/.test(source) || /unpkg\.com\/leaflet/.test(source);
}

describe('Leaflet is frozen', () => {
  it('is consumed by exactly the two modules that already existed', () => {
    const consumers = sourceFiles(SRC)
      .filter(consumesLeaflet)
      .map((path) => relative(SRC, path).replace(/\\/g, '/'))
      .sort();

    expect(consumers).toEqual(FROZEN);
  });
});
