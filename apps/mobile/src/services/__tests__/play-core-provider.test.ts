import { Platform, NativeModules } from 'react-native';
import { PlayCoreUpdateProvider } from '../play-core-provider';

// Mock sp-react-native-in-app-updates
const mockStartUpdate = jest.fn();
const mockCheckNeedsUpdate = jest.fn();

jest.mock('sp-react-native-in-app-updates', () => {
  const MockSpInAppUpdates = jest.fn().mockImplementation(() => ({
    startUpdate: mockStartUpdate,
    checkNeedsUpdate: mockCheckNeedsUpdate,
  }));
  return {
    __esModule: true,
    default: MockSpInAppUpdates,
    IAUUpdateKind: {
      FLEXIBLE: 0,
      IMMEDIATE: 1,
    },
  };
});

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

  describe('triggerUpdate()', () => {
    it('triggers IMMEDIATE update when mode is immediate', async () => {
      mockStartUpdate.mockResolvedValueOnce(undefined);
      const provider = new PlayCoreUpdateProvider();

      await provider.triggerUpdate({ mode: 'immediate' });

      expect(mockStartUpdate).toHaveBeenCalledWith({ updateType: 1 });
    });

    it('triggers FLEXIBLE update when mode is flexible', async () => {
      mockStartUpdate.mockResolvedValueOnce(undefined);
      const provider = new PlayCoreUpdateProvider();

      await provider.triggerUpdate({ mode: 'flexible' });

      expect(mockStartUpdate).toHaveBeenCalledWith({ updateType: 0 });
    });

    it('defaults to FLEXIBLE update when mode is not specified', async () => {
      mockStartUpdate.mockResolvedValueOnce(undefined);
      const provider = new PlayCoreUpdateProvider();

      await provider.triggerUpdate();

      expect(mockStartUpdate).toHaveBeenCalledWith({ updateType: 0 });
    });

    it('propagates error when startUpdate rejects so fallback can take over', async () => {
      mockStartUpdate.mockRejectedValueOnce(new Error('Play Core API failure'));
      const provider = new PlayCoreUpdateProvider();

      await expect(provider.triggerUpdate({ mode: 'immediate' })).rejects.toThrow(
        'Play Core API failure',
      );
    });
  });
});
