import { describe, expect, it } from '@jest/globals';

import { parseBrowserCapability } from '@/components/map/browser-capability';

/**
 * Real user agents, one per capability class the check has to tell apart.
 *
 * The iOS 15 pair is the profile the field reports came from: Safari 15.6.8 on
 * iOS 15.8.8 cannot run MapLibre v6's module worker, so every iPhone on that OS
 * sees the same failure no matter how many times it retries.
 */
const IOS_15_SAFARI_15 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.8 Mobile/15E148 Safari/604.1';

const IOS_16_4_SAFARI_16 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1';

const IOS_17_SAFARI_17 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const MAC_SAFARI_17 =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const DESKTOP_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

describe('parseBrowserCapability', () => {
  it('rejects the iOS 15 Safari the field reports came from', () => {
    const capability = parseBrowserCapability(IOS_15_SAFARI_15);
    expect(capability.mapSupported).toBe(false);
    // The sentence the walker reads needs the OS the device actually has.
    expect(capability.osVersion).toBe('iOS 15.8.8');
    expect(capability.browserVersion).toBe('15.6.8');
  });

  it('accepts iOS 16.4, the first Safari that can run the module worker', () => {
    expect(parseBrowserCapability(IOS_16_4_SAFARI_16).mapSupported).toBe(true);
  });

  it('accepts newer iOS Safari releases', () => {
    expect(parseBrowserCapability(IOS_17_SAFARI_17).mapSupported).toBe(true);
  });

  it('accepts desktop Safari on macOS', () => {
    expect(parseBrowserCapability(MAC_SAFARI_17).mapSupported).toBe(true);
  });

  it('accepts Android Chrome, which never had the module-worker gap', () => {
    expect(parseBrowserCapability(ANDROID_CHROME).mapSupported).toBe(true);
  });

  it('accepts desktop Chrome', () => {
    expect(parseBrowserCapability(DESKTOP_CHROME).mapSupported).toBe(true);
  });

  it('reads a null OS version as an unknown device rather than a refusal', () => {
    // Unrecognized agents must not lock the map away: an unknown profile is a
    // wait for evidence, not a verdict. The map attempt reports its own failure.
    expect(parseBrowserCapability('some unknown agent').mapSupported).toBe(true);
    expect(parseBrowserCapability('some unknown agent').osVersion).toBeNull();
  });
});
