// Set environment variables before imports so the module picks them up during initialization
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project-id';

import { Platform } from 'react-native';
import { AnalyticsService } from '../analytics';

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

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn().mockReturnValue({}),
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn().mockReturnValue({}),

  logEvent: (...args: unknown[]) =>
    mockWebLogEvent(...(args as [never, string, Record<string, string>?])),
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
    expect(mockLogEvent).toHaveBeenCalledWith('test_event', { foo: 'bar', platform: 'ios' });
  });

  it('records errors on native platform', () => {
    platform.OS = 'ios';
    const error = new Error('Test error');
    AnalyticsService.recordError(error, 'Custom description');
    expect(mockSetAttribute).toHaveBeenCalledWith('custom_description', 'Custom description');
    expect(mockRecordError).toHaveBeenCalledWith(error);
  });

  it('tracks events on web platform using Web Firebase SDK', () => {
    platform.OS = 'web';
    AnalyticsService.trackEvent('test_web_event', { foo: 'web_bar' });
    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(mockWebLogEvent).toHaveBeenCalledWith(expect.any(Object), 'test_web_event', {
      foo: 'web_bar',
      platform: 'web',
    });
  });

  it('logs error on console for web platform', () => {
    platform.OS = 'web';
    const error = new Error('Web test error');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    AnalyticsService.recordError(error, 'Web custom description');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR]',
      '[Web Error]',
      error,
      'Web custom description',
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

      AnalyticsService.initializeGlobalErrorTracking();

      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

      if (originalWindow) {
        global.window = originalWindow;
      } else {
        delete global.window;
      }
    });
  });
});
