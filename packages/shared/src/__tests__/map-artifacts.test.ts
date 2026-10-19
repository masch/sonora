import { describe, expect, it } from 'vitest';

import { mapArchivePath, mapStylePath } from '../map/artifacts';

describe('map artifact paths', () => {
  it('builds the archive path of a region, defaulting to the compiled region and version', () => {
    expect(mapArchivePath()).toBe('/media/public/tiles/calamuchita/v1.pmtiles');
    expect(mapArchivePath('calamuchita', 'v7')).toBe('/media/public/tiles/calamuchita/v7.pmtiles');
  });

  it('builds the style path, defaulting to the compiled version', () => {
    expect(mapStylePath()).toBe('/media/public/styles/v1.json');
    expect(mapStylePath('v7')).toBe('/media/public/styles/v7.json');
  });
});
