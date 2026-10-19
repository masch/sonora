import { isLocalOrigin, resolveMapArtifacts } from '@/config/map-artifacts';

describe('resolveMapArtifacts', () => {
  it('derives both urls from the API origin this build talks to', () => {
    expect(resolveMapArtifacts({ apiBaseUrl: 'https://api.sonora.app' })).toEqual({
      archiveUrl: 'https://api.sonora.app/media/public/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://api.sonora.app/media/public/styles/v1.json',
    });

    expect(resolveMapArtifacts({ apiBaseUrl: 'https://api.sonora.app/' })).toEqual({
      archiveUrl: 'https://api.sonora.app/media/public/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://api.sonora.app/media/public/styles/v1.json',
    });
  });

  it('sends no artifacts for an origin that only exists on this machine', () => {
    for (const apiBaseUrl of [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://10.0.2.2:3000',
      'http://192.168.1.42:3000',
      'http://172.20.0.5:3000',
    ]) {
      expect(resolveMapArtifacts({ apiBaseUrl })).toEqual({ archiveUrl: '', styleUrl: '' });
      expect(isLocalOrigin(apiBaseUrl)).toBe(true);
    }
  });

  it('lets the build override each url, including on a local origin', () => {
    expect(
      resolveMapArtifacts({
        apiBaseUrl: 'http://localhost:3000',
        archiveUrlOverride: 'https://staging.example/tiles/calamuchita/v1.pmtiles',
        styleUrlOverride: 'https://staging.example/styles/v1.json',
      }),
    ).toEqual({
      archiveUrl: 'https://staging.example/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://staging.example/styles/v1.json',
    });

    expect(
      resolveMapArtifacts({
        apiBaseUrl: 'http://localhost:3000',
        archiveUrlOverride: 'https://staging.example/tiles/calamuchita/v1.pmtiles',
      }),
    ).toEqual({
      archiveUrl: 'https://staging.example/tiles/calamuchita/v1.pmtiles',
      styleUrl: '',
    });
  });
});
