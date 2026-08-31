import { Platform } from 'react-native';
import { isIosBrowser } from '../platform';

describe('isIosBrowser', () => {
  const originalPlatformOS = Platform.OS;
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  const mockBrowserEnvironment = (userAgent: string, platform = 'MacIntel', maxTouchPoints = 0) => {
    Platform.OS = 'web';
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent,
        platform,
        maxTouchPoints,
      },
      configurable: true,
      writable: true,
    });
  };

  it('returns false when Platform.OS is native ios', () => {
    Platform.OS = 'ios';
    expect(isIosBrowser()).toBe(false);
  });

  it('returns false when Platform.OS is native android', () => {
    Platform.OS = 'android';
    expect(isIosBrowser()).toBe(false);
  });

  it('returns true on iPhone Safari web', () => {
    mockBrowserEnvironment(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5,
    );
    expect(isIosBrowser()).toBe(true);
  });

  it('returns true on iPhone Chrome (CriOS) web', () => {
    mockBrowserEnvironment(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
      'iPhone',
      5,
    );
    expect(isIosBrowser()).toBe(true);
  });

  it('returns true on iPad Safari web', () => {
    mockBrowserEnvironment(
      'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      'iPad',
      5,
    );
    expect(isIosBrowser()).toBe(true);
  });

  it('returns true on iPadOS desktop-class Safari web (MacIntel with touch points)', () => {
    mockBrowserEnvironment(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'MacIntel',
      5,
    );
    expect(isIosBrowser()).toBe(true);
  });

  it('returns false on macOS Desktop Safari / Chrome (MacIntel without touch points)', () => {
    mockBrowserEnvironment(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'MacIntel',
      0,
    );
    expect(isIosBrowser()).toBe(false);
  });

  it('returns false on Android Chrome web', () => {
    mockBrowserEnvironment(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
      'Linux armv8l',
      5,
    );
    expect(isIosBrowser()).toBe(false);
  });

  it('returns false on Windows Desktop Chrome', () => {
    mockBrowserEnvironment(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Win32',
      0,
    );
    expect(isIosBrowser()).toBe(false);
  });

  it('returns false in SSR environment when window is undefined', () => {
    Platform.OS = 'web';
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(isIosBrowser()).toBe(false);
  });

  it('returns false when navigator is undefined', () => {
    Platform.OS = 'web';
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(isIosBrowser()).toBe(false);
  });

  it('handles missing userAgent gracefully', () => {
    mockBrowserEnvironment('');
    expect(isIosBrowser()).toBe(false);
  });
});
