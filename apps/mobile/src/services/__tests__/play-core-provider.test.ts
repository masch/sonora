import { Platform, NativeModules } from 'react-native';
import { PlayCoreUpdateProvider } from '../play-core-provider';
import { AnalyticsService } from '../analytics';

// Stable references for mocked methods
const mockStartUpdate = jest.fn();
const mockCheckNeedsUpdate = jest.fn();
const mockInstallUpdate = jest.fn();
const mockAddStatusUpdateListener = jest.fn();
const mockRemoveStatusUpdateListener = jest.fn();

jest.mock('sp-react-native-in-app-updates', () => {
  const MockSpInAppUpdates = jest.fn().mockImplementation(() => ({
    startUpdate: mockStartUpdate,
    checkNeedsUpdate: mockCheckNeedsUpdate,
    installUpdate: mockInstallUpdate,
    addStatusUpdateListener: mockAddStatusUpdateListener,
    removeStatusUpdateListener: mockRemoveStatusUpdateListener,
  }));
  return {
    __esModule: true,
    default: MockSpInAppUpdates,
    IAUUpdateKind: { FLEXIBLE: 0, IMMEDIATE: 1 },
    IAUInstallStatus: {
      UNKNOWN: 0,
      PENDING: 1,
      DOWNLOADING: 2,
      INSTALLING: 3,
      INSTALLED: 4,
      FAILED: 5,
      CANCELED: 6,
      DOWNLOADED: 11,
    },
  };
});

jest.mock('../analytics', () => ({
  AnalyticsService: { trackEvent: jest.fn() },
}));

describe('PlayCoreUpdateProvider', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    NativeModules.SpInAppUpdates = {};
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  describe('isAvailable()', () => {
    it('returns true on android platform', async () => {
      const provider = new PlayCoreUpdateProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('returns false on iOS platform', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });
      const provider = new PlayCoreUpdateProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('returns false on Web platform', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
        configurable: true,
      });
      const provider = new PlayCoreUpdateProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('checkForUpdate()', () => {
    it('returns true when an update is available', async () => {
      mockCheckNeedsUpdate.mockResolvedValueOnce({ shouldUpdate: true });
      const provider = new PlayCoreUpdateProvider();
      await expect(provider.checkForUpdate()).resolves.toBe(true);
    });

    it('returns false when no update is available', async () => {
      mockCheckNeedsUpdate.mockResolvedValueOnce({ shouldUpdate: false });
      const provider = new PlayCoreUpdateProvider();
      await expect(provider.checkForUpdate()).resolves.toBe(false);
    });
  });

  describe('triggerUpdate()', () => {
    it('triggers IMMEDIATE update when mode is immediate', async () => {
      mockStartUpdate.mockResolvedValueOnce(undefined);
      const provider = new PlayCoreUpdateProvider();

      await provider.triggerUpdate({ mode: 'immediate' });

      expect(mockStartUpdate).toHaveBeenCalledWith({ updateType: 1 });
    });

    it('propagates error when startUpdate rejects so fallback can take over', async () => {
      mockStartUpdate.mockRejectedValueOnce(new Error('Play Core API failure'));
      const provider = new PlayCoreUpdateProvider();

      await expect(provider.triggerUpdate({ mode: 'immediate' })).rejects.toThrow(
        'Play Core API failure',
      );
    });

    it('resolves after DOWNLOADED status and calls installUpdate for FLEXIBLE mode', async () => {
      mockStartUpdate.mockResolvedValueOnce(undefined);
      // Simulate the listener being called with DOWNLOADED status
      mockAddStatusUpdateListener.mockImplementation((cb: (e: { status: number }) => void) => {
        setImmediate(() => cb({ status: 11 /* DOWNLOADED */ }));
      });

      const provider = new PlayCoreUpdateProvider();
      await provider.triggerUpdate({ mode: 'flexible' });

      expect(mockInstallUpdate).toHaveBeenCalled();
      expect(mockRemoveStatusUpdateListener).toHaveBeenCalled();
    });

    it('defaults to FLEXIBLE update when mode is not specified', async () => {
      mockStartUpdate.mockResolvedValueOnce(undefined);
      mockAddStatusUpdateListener.mockImplementation((cb: (e: { status: number }) => void) => {
        setImmediate(() => cb({ status: 11 /* DOWNLOADED */ }));
      });

      const provider = new PlayCoreUpdateProvider();
      await provider.triggerUpdate();

      expect(mockStartUpdate).toHaveBeenCalledWith({ updateType: 0 });
    });

    it('rejects and fires update_download_failed when FLEXIBLE status is FAILED', async () => {
      mockStartUpdate.mockResolvedValueOnce(undefined);
      mockAddStatusUpdateListener.mockImplementation((cb: (e: { status: number }) => void) => {
        setImmediate(() => cb({ status: 5 /* FAILED */ }));
      });

      const provider = new PlayCoreUpdateProvider();
      await expect(provider.triggerUpdate({ mode: 'flexible' })).rejects.toThrow(
        'Flexible update ended with status: 5',
      );
      expect(AnalyticsService.trackEvent).toHaveBeenCalledWith('update_download_failed', {
        error_code: 5,
      });
    });

    it('rejects and fires update_download_canceled when FLEXIBLE status is CANCELED', async () => {
      mockStartUpdate.mockResolvedValueOnce(undefined);
      mockAddStatusUpdateListener.mockImplementation((cb: (e: { status: number }) => void) => {
        setImmediate(() => cb({ status: 6 /* CANCELED */ }));
      });

      const provider = new PlayCoreUpdateProvider();
      await expect(provider.triggerUpdate({ mode: 'flexible' })).rejects.toThrow(
        'Flexible update ended with status: 6',
      );
      expect(AnalyticsService.trackEvent).toHaveBeenCalledWith('update_download_canceled', {
        error_code: 6,
      });
    });
  });
});
