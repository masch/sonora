import { describe, expect, it } from 'vitest';

import { mapArchiveKey, mapArchivePath, mapStyleKey, mapStylePath } from '../map/artifacts';

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

describe('map artifact bucket keys', () => {
  it('builds the key the upload writes and the head reads', () => {
    // The path the client receives and the key the bucket stores differ only by
    // the public media prefix, so the head at /config time cannot drift from the
    // url it publishes.
    expect(mapArchiveKey()).toBe('tiles/calamuchita/v1.pmtiles');
    expect(mapArchiveKey('calamuchita', 'v7')).toBe('tiles/calamuchita/v7.pmtiles');
    expect(mapStyleKey()).toBe('styles/v1.json');
    expect(mapStyleKey('v7')).toBe('styles/v7.json');

    expect(mapArchivePath('calamuchita', 'v7')).toContain(mapArchiveKey('calamuchita', 'v7'));
    expect(mapStylePath('v7')).toContain(mapStyleKey('v7'));
  });
});
