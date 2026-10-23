import type { MapDownloadPolicy } from '@sonora/shared';

import { decideDownload } from '@/services/map-download-policy';

const POLICY: MapDownloadPolicy = {
  preload: ['osm-calamuchita'],
  autoMaxBytes: 8_000_000,
  cacheMaxBytes: 100_000_000,
  cellular: 'ask',
};

describe('decideDownload', () => {
  it('downloads without asking on WiFi under the silent ceiling', () => {
    expect(decideDownload({ bytes: 826_000, network: 'wifi', policy: POLICY })).toBe('download');
  });

  it('asks on WiFi when the archive is above the silent ceiling', () => {
    expect(decideDownload({ bytes: 9_000_000, network: 'wifi', policy: POLICY })).toBe('ask');
  });

  it('asks on cellular when the policy is ask, whatever the size', () => {
    expect(decideDownload({ bytes: 826_000, network: 'cellular', policy: POLICY })).toBe('ask');
    expect(decideDownload({ bytes: 9_000_000, network: 'cellular', policy: POLICY })).toBe('ask');
  });

  it('treats cellular as WiFi when the policy is auto, ceiling included', () => {
    const auto = { ...POLICY, cellular: 'auto' as const };
    expect(decideDownload({ bytes: 826_000, network: 'cellular', policy: auto })).toBe('download');
    expect(decideDownload({ bytes: 9_000_000, network: 'cellular', policy: auto })).toBe('ask');
  });

  it('downloads nothing when the policy is never, even on WiFi', () => {
    const never = { ...POLICY, cellular: 'never' as const };
    expect(decideDownload({ bytes: 826_000, network: 'cellular', policy: never })).toBe('skip');
    expect(decideDownload({ bytes: 826_000, network: 'wifi', policy: never })).toBe('download');
  });

  it('downloads nothing when there is no network to download from', () => {
    expect(decideDownload({ bytes: 826_000, network: 'offline', policy: POLICY })).toBe('skip');
  });

  it('asks on a network it cannot price, rather than spending the walker data', () => {
    expect(decideDownload({ bytes: 826_000, network: 'other', policy: POLICY })).toBe('ask');
  });

  it('treats the ceiling as inclusive: exactly at it is still silent', () => {
    expect(decideDownload({ bytes: POLICY.autoMaxBytes, network: 'wifi', policy: POLICY })).toBe(
      'download',
    );
    expect(
      decideDownload({ bytes: POLICY.autoMaxBytes + 1, network: 'wifi', policy: POLICY }),
    ).toBe('ask');
  });
});
