// Set environment variables before imports so the module picks them up during initialization
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project-id';

import { Platform, NativeModules } from 'react-native';

// Mock RNFBAppModule so that isFirebaseAvailable() returns true on native tests
NativeModules.RNFBAppModule = {};

import { AnalyticsService } from '../analytics';
import { errorReference } from '@/utils/error-reference';

const { AnalyticsService: AnalyticsServiceWeb } = jest.requireActual<{
  AnalyticsService: typeof AnalyticsService;
}>('../analytics.web');

const mockLogEvent = jest.fn();
const mockRecordError = jest.fn();
const mockSetAttribute = jest.fn();
const mockWebLogEvent = jest.fn();

jest.mock('@react-native-firebase/analytics', () => {
  return {
    __esModule: true,
    default: () => ({
      logEvent: mockLogEvent,
    }),
  };
});

jest.mock('@react-native-firebase/crashlytics', () => {
  return {
    __esModule: true,
    default: () => ({
      recordError: mockRecordError,
      setAttribute: mockSetAttribute,
    }),
  };
});
// react-native-firebase mocks are handled locally to assert on log/error spies

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn().mockReturnValue({}),

  logEvent: (...args: unknown[]) =>
    mockWebLogEvent(...(args as [never, string, Record<string, string>?])),
}));

jest.mock('@/utils/app-version', () => ({
  getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }),
}));

const platform: { OS: string } = Platform as { OS: string };
const originalOS = platform.OS;

describe('AnalyticsService', () => {
  beforeEach(() => {
    platform.OS = originalOS;
    jest.clearAllMocks();
  });

  afterAll(() => {
    platform.OS = originalOS;
  });

  it('tracks events on native platform', () => {
    platform.OS = 'ios';
    AnalyticsService.trackEvent('test_event', { foo: 'bar' });
    expect(mockLogEvent).toHaveBeenCalledWith('test_event', {
      foo: 'bar',
      platform: 'ios',
      app_version: 'test-version',
    });
  });

  it('records errors on native platform', () => {
    platform.OS = 'ios';
    const error = new Error('Test error');
    AnalyticsService.recordError(error, 'Custom description');
    expect(mockSetAttribute).toHaveBeenCalledWith('custom_description', 'Custom description');
    expect(mockSetAttribute).toHaveBeenCalledWith('app_version', 'test-version');
    expect(mockRecordError).toHaveBeenCalledWith(error);
  });

  it('writes the caller context into the crash attributes', () => {
    platform.OS = 'ios';
    AnalyticsService.recordError(new Error('boom'), 'desc', {
      reference: 'E-ABC123',
      route: '/trip/abc',
      fatal: true,
    });

    expect(mockSetAttribute).toHaveBeenCalledWith('error_reference', 'E-ABC123');
    expect(mockSetAttribute).toHaveBeenCalledWith('route', '/trip/abc');
  });

  it('never records the previous crash description on a report that has none', () => {
    platform.OS = 'ios';
    // The description is a global attribute too: a report without one must clear it
    // instead of letting the previous crash's sentence label this one.
    AnalyticsService.recordError(new Error('first'), 'Root ErrorBoundary caught layout error');
    mockSetAttribute.mockClear();

    AnalyticsService.recordError(new Error('second'));

    expect(mockSetAttribute).toHaveBeenCalledWith('custom_description', '');
    expect(mockSetAttribute).not.toHaveBeenCalledWith(
      'custom_description',
      'Root ErrorBoundary caught layout error',
    );
  });

  it('never records the previous crash reference or route on a call without context', () => {
    platform.OS = 'ios';
    // Crashlytics attributes are global: an earlier crash wrote a reference and a
    // route, and a later report that omits them must not inherit either of them.
    AnalyticsService.recordError(new Error('first'), 'desc', {
      reference: 'E-ABC123',
      route: '/trip/abc',
      fatal: true,
    });
    mockSetAttribute.mockClear();

    const second = new Error('second');
    AnalyticsService.recordError(second, 'desc');

    // Its own derived code — the one the screen shows for this error — and no route.
    expect(mockSetAttribute).toHaveBeenCalledWith('error_reference', errorReference(second));
    expect(mockSetAttribute).toHaveBeenCalledWith('route', '');
    expect(mockSetAttribute).not.toHaveBeenCalledWith('error_reference', 'E-ABC123');
    expect(mockSetAttribute).not.toHaveBeenCalledWith('route', '/trip/abc');
  });

  it('tracks events on web platform using Web Firebase SDK', () => {
    platform.OS = 'web';
    AnalyticsServiceWeb.trackEvent('test_web_event', { foo: 'web_bar' });
    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(mockWebLogEvent).toHaveBeenCalledWith(expect.any(Object), 'test_web_event', {
      foo: 'web_bar',
      platform: 'web',
      app_version: 'test-version',
    });
  });

  it('logs error on console for web platform', () => {
    platform.OS = 'web';
    const error = new Error('Web test error');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    AnalyticsServiceWeb.recordError(error, 'Web custom description');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR]',
      '[Web Error]',
      error,
      'Web custom description',
      { app_version: 'test-version' },
    );
    consoleErrorSpy.mockRestore();
  });

  describe('initializeGlobalErrorTracking', () => {
    it('sets up unhandledrejection listener on web', () => {
      platform.OS = 'web';
      const mockAddEventListener = jest.fn();
      const global = globalThis as unknown as { window: Window | undefined };
      const originalWindow = global.window;
      global.window = {
        addEventListener: mockAddEventListener,
      } as unknown as Window & typeof globalThis;

      AnalyticsServiceWeb.initializeGlobalErrorTracking();

      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

      if (originalWindow) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    });
  });

  it('conforms to the AnalyticsTracker contract interface across platforms', () => {
    expect(typeof AnalyticsService.trackEvent).toBe('function');
    expect(typeof AnalyticsService.recordError).toBe('function');
    expect(typeof AnalyticsService.initializeGlobalErrorTracking).toBe('function');

    expect(typeof AnalyticsServiceWeb.trackEvent).toBe('function');
    expect(typeof AnalyticsServiceWeb.recordError).toBe('function');
    expect(typeof AnalyticsServiceWeb.initializeGlobalErrorTracking).toBe('function');
  });
});
