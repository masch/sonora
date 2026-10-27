import { Platform } from 'react-native';

const mockLogEvent = jest.fn();
const mockInitializeApp = jest.fn().mockReturnValue({});
const mockGetAnalytics = jest.fn().mockReturnValue({});

jest.mock('firebase/analytics', () => ({
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

jest.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => mockInitializeApp(...args),
}));

jest.mock('@/utils/app-version', () => ({
  getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }),
}));

const CREDENTIAL_ENV_VARS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
] as const;

const env = process.env as Record<string, string | undefined>;
const originalEnv: Record<string, string | undefined> = {};
for (const key of CREDENTIAL_ENV_VARS) {
  originalEnv[key] = env[key];
}

const globalScope = globalThis as { window?: unknown };
const originalWindow = globalScope.window;

function setCredentials(): void {
  env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
  env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project-id';
  env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID = 'G-TEST';
}

function clearCredentials(): void {
  for (const key of CREDENTIAL_ENV_VARS) {
    delete env[key];
  }
}

/** Loads a fresh copy of the web implementation so initialization state does not leak. */
function loadAnalyticsWeb() {
  return jest.requireActual<{
    AnalyticsService: {
      recordError: (
        error: Error,
        customDescription?: string,
        context?: { reference?: string; route?: string; fatal?: boolean },
      ) => void;
    };
  }>('../analytics.web').AnalyticsService;
}

describe('analytics.web recordError', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    globalScope.window = {};
  });

  afterEach(() => {
    for (const key of CREDENTIAL_ENV_VARS) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete env[key];
      } else {
        env[key] = original;
      }
    }
    if (originalWindow === undefined) {
      delete globalScope.window;
    } else {
      globalScope.window = originalWindow;
    }
  });

  it('emits one app_error event carrying the reference, route, fatal flag and a truncated message', () => {
    setCredentials();
    const AnalyticsService = loadAnalyticsWeb();
    const error = new Error('x'.repeat(200));

    AnalyticsService.recordError(error, 'desc', {
      reference: 'E-ABC123',
      route: '/trip/x',
      fatal: true,
    });

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    const [, eventName, params] = mockLogEvent.mock.calls[0] as [
      unknown,
      string,
      Record<string, unknown>,
    ];
    expect(eventName).toBe('app_error');
    expect(params).toEqual({
      error_reference: 'E-ABC123',
      route: '/trip/x',
      message: 'x'.repeat(150),
      fatal: true,
      platform: Platform.OS,
      app_version: 'test-version',
    });
  });

  it('keeps the console fallback and emits nothing when the credentials are missing', () => {
    clearCredentials();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const AnalyticsService = loadAnalyticsWeb();

    AnalyticsService.recordError(new Error('boom'), 'desc', {
      reference: 'E-ABC123',
      route: '/trip/x',
      fatal: true,
    });

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR]',
      '[Web Error]',
      expect.any(Error),
      'desc',
      expect.objectContaining({
        error_reference: 'E-ABC123',
        route: '/trip/x',
        message: 'boom',
        fatal: true,
      }),
      { app_version: 'test-version' },
    );

    consoleErrorSpy.mockRestore();
  });
});
