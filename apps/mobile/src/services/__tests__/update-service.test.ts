import { Linking, Platform } from 'react-native';
import { UpdateService, DeepLinkUpdateProvider, type UpdateProvider } from '../update-service';
import * as storeUrlModule from '../store-url';
import { AnalyticsService } from '../analytics';

jest.mock('expo-application', () => ({
  applicationId: 'org.sonoraderivapoeticas.app',
}));

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
  Platform: {
    OS: 'android',
  },
  NativeModules: {},
}));

describe('UpdateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DeepLinkUpdateProvider', () => {
    it('is always available', async () => {
      const provider = new DeepLinkUpdateProvider();
      await expect(provider.isAvailable()).resolves.toBe(true);
    });

    it('returns false for checkForUpdate', async () => {
      const provider = new DeepLinkUpdateProvider();
      await expect(provider.checkForUpdate({ source: 'manual' })).resolves.toBe(false);
    });

    it('opens primary URL if canOpenURL is true', async () => {
      jest.spyOn(storeUrlModule, 'getStoreUrls').mockReturnValue({
        primary: 'market://details?id=test',
        fallback: 'https://play.google.com/store/apps/details?id=test',
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
      (Linking.openURL as jest.Mock).mockResolvedValue(true);

      const provider = new DeepLinkUpdateProvider();
      await provider.triggerUpdate();

      expect(Linking.canOpenURL).toHaveBeenCalledWith('market://details?id=test');
      expect(Linking.openURL).toHaveBeenCalledWith('market://details?id=test');
    });

    it('falls back to fallback URL if canOpenURL is false', async () => {
      jest.spyOn(storeUrlModule, 'getStoreUrls').mockReturnValue({
        primary: 'market://details?id=test',
        fallback: 'https://play.google.com/store/apps/details?id=test',
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
      (Linking.openURL as jest.Mock).mockResolvedValue(true);

      const provider = new DeepLinkUpdateProvider();
      await provider.triggerUpdate();

      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=test',
      );
    });

    it('falls back to fallback URL if opening primary URL throws', async () => {
      jest.spyOn(storeUrlModule, 'getStoreUrls').mockReturnValue({
        primary: 'market://details?id=test',
        fallback: 'https://play.google.com/store/apps/details?id=test',
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
      (Linking.openURL as jest.Mock)
        .mockRejectedValueOnce(new Error('Market app failed'))
        .mockResolvedValueOnce(true);

      const provider = new DeepLinkUpdateProvider();
      await provider.triggerUpdate();

      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=test',
      );
    });

    it('propagates error when both primary and fallback URLs reject', async () => {
      jest.spyOn(storeUrlModule, 'getStoreUrls').mockReturnValue({
        primary: 'market://details?id=test',
        fallback: 'https://play.google.com/store/apps/details?id=test',
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Store app unavailable'));

      const provider = new DeepLinkUpdateProvider();
      await expect(provider.triggerUpdate()).rejects.toThrow('Store app unavailable');
    });

    it('throws error when primary fails and no fallback exists', async () => {
      jest.spyOn(storeUrlModule, 'getStoreUrls').mockReturnValue({
        primary: 'market://details?id=test',
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

      const provider = new DeepLinkUpdateProvider();
      let errorThrown: Error | null = null;
      try {
        await provider.triggerUpdate();
      } catch (err) {
        errorThrown = err as Error;
      }
      expect(errorThrown).not.toBeNull();
      expect(errorThrown?.message).toBeDefined();
    });

    it('reloads window on web platform', async () => {
      const mockReload = jest.fn();
      const originalWindow = globalThis.window;
      Object.defineProperty(globalThis, 'window', {
        value: { location: { reload: mockReload } },
        configurable: true,
      });

      const originalPlatformOS = Platform.OS;
      Platform.OS = 'web';

      try {
        const provider = new DeepLinkUpdateProvider();
        await provider.triggerUpdate();

        expect(mockReload).toHaveBeenCalledTimes(1);
        expect(Linking.openURL).not.toHaveBeenCalled();
      } finally {
        Platform.OS = originalPlatformOS;
        Object.defineProperty(globalThis, 'window', {
          value: originalWindow,
          configurable: true,
        });
      }
    });
  });

  describe('Graceful Degradation / Fallback in UpdateService', () => {
    it('invokes primary provider when available', async () => {
      const primaryMock: UpdateProvider = {
        name: 'mock-native',
        isAvailable: jest.fn().mockResolvedValue(true),
        triggerUpdate: jest.fn().mockResolvedValue(undefined),
      };
      const fallbackMock: UpdateProvider = {
        name: 'mock-fallback',
        isAvailable: jest.fn().mockResolvedValue(true),
        triggerUpdate: jest.fn().mockResolvedValue(undefined),
      };

      const service = new UpdateService([primaryMock, fallbackMock]);
      await service.triggerUpdate({ mode: 'immediate' });

      expect(primaryMock.triggerUpdate).toHaveBeenCalledWith({ mode: 'immediate' });
      expect(fallbackMock.triggerUpdate).not.toHaveBeenCalled();
    });

    it('falls back to next provider if primary provider is unavailable', async () => {
      const primaryMock: UpdateProvider = {
        name: 'mock-native',
        isAvailable: jest.fn().mockResolvedValue(false),
        triggerUpdate: jest.fn(),
      };
      const fallbackMock: UpdateProvider = {
        name: 'mock-fallback',
        isAvailable: jest.fn().mockResolvedValue(true),
        triggerUpdate: jest.fn().mockResolvedValue(undefined),
      };

      const service = new UpdateService([primaryMock, fallbackMock]);
      await service.triggerUpdate();

      expect(primaryMock.triggerUpdate).not.toHaveBeenCalled();
      expect(fallbackMock.triggerUpdate).toHaveBeenCalled();
    });

    it('falls back to next provider if primary provider throws during triggerUpdate', async () => {
      const primaryMock: UpdateProvider = {
        name: 'mock-native',
        isAvailable: jest.fn().mockResolvedValue(true),
        triggerUpdate: jest.fn().mockRejectedValue(new Error('Play Core crash')),
      };
      const fallbackMock: UpdateProvider = {
        name: 'mock-fallback',
        isAvailable: jest.fn().mockResolvedValue(true),
        triggerUpdate: jest.fn().mockResolvedValue(undefined),
      };

      const service = new UpdateService([primaryMock, fallbackMock]);
      await service.triggerUpdate();

      expect(primaryMock.triggerUpdate).toHaveBeenCalled();
      expect(fallbackMock.triggerUpdate).toHaveBeenCalled();
    });

    it('initializes with PlayCoreUpdateProvider and DeepLinkUpdateProvider by default', async () => {
      const service = new UpdateService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const providers = (service as any).providers as UpdateProvider[];

      expect(providers).toHaveLength(2);
      expect(providers[0].name).toBe('play-core');
      expect(providers[1].name).toBe('deep-link');
    });

    it('falls back to DeepLinkUpdateProvider when PlayCoreUpdateProvider.triggerUpdate throws', async () => {
      // Build the real default service (PlayCore → DeepLink)
      const service = new UpdateService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const providers = (service as any).providers as UpdateProvider[];

      // PlayCore is not available (NativeModules.SpInAppUpdates is undefined in test env),
      // so make isAvailable return true to force triggerUpdate to run and throw.
      jest.spyOn(providers[0], 'isAvailable').mockResolvedValue(true);
      jest
        .spyOn(providers[0], 'triggerUpdate')
        .mockRejectedValue(new Error('Play Core unavailable'));

      // DeepLink should open the store URL as fallback
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
      (Linking.openURL as jest.Mock).mockResolvedValue(undefined);

      await service.triggerUpdate();

      expect(providers[0].triggerUpdate).toHaveBeenCalled();
      expect(Linking.openURL).toHaveBeenCalled();
    });

    it('prepends provider when registerProvider called with prepend=true', () => {
      const service = new UpdateService([]);
      const p1: UpdateProvider = { name: 'p1', isAvailable: jest.fn(), triggerUpdate: jest.fn() };
      const p2: UpdateProvider = { name: 'p2', isAvailable: jest.fn(), triggerUpdate: jest.fn() };
      service.registerProvider(p1);
      service.registerProvider(p2, true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).providers).toEqual([p2, p1]);
    });

    it('appends provider when registerProvider called with prepend=false', () => {
      const service = new UpdateService([]);
      const p1: UpdateProvider = { name: 'p1', isAvailable: jest.fn(), triggerUpdate: jest.fn() };
      const p2: UpdateProvider = { name: 'p2', isAvailable: jest.fn(), triggerUpdate: jest.fn() };
      service.registerProvider(p1);
      service.registerProvider(p2, false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).providers).toEqual([p1, p2]);
    });
  });

  describe('checkForUpdate', () => {
    it('returns true when a provider reports an update is available', async () => {
      const mockProvider: UpdateProvider = {
        name: 'mock',
        isAvailable: jest.fn().mockResolvedValue(true),
        checkForUpdate: jest.fn().mockResolvedValue(true),
        triggerUpdate: jest.fn(),
      };
      const service = new UpdateService([mockProvider]);

      const result = await service.checkForUpdate({ source: 'startup' });
      expect(result).toBe(true);
      expect(mockProvider.checkForUpdate).toHaveBeenCalledWith({ source: 'startup' });
    });

    it('returns false when provider reports no update', async () => {
      const mockProvider: UpdateProvider = {
        name: 'mock',
        isAvailable: jest.fn().mockResolvedValue(true),
        checkForUpdate: jest.fn().mockResolvedValue(false),
        triggerUpdate: jest.fn(),
      };
      const service = new UpdateService([mockProvider]);

      const result = await service.checkForUpdate({ source: 'manual' });
      expect(result).toBe(false);
    });

    it('falls back to next provider if first provider throws', async () => {
      const failingProvider: UpdateProvider = {
        name: 'failing',
        isAvailable: jest.fn().mockResolvedValue(true),
        checkForUpdate: jest.fn().mockRejectedValue(new Error('Network error')),
        triggerUpdate: jest.fn(),
      };
      const fallbackProvider: UpdateProvider = {
        name: 'fallback',
        isAvailable: jest.fn().mockResolvedValue(true),
        checkForUpdate: jest.fn().mockResolvedValue(true),
        triggerUpdate: jest.fn(),
      };
      const service = new UpdateService([failingProvider, fallbackProvider]);

      const result = await service.checkForUpdate({ source: 'manual' });
      expect(result).toBe(true);
      expect(fallbackProvider.checkForUpdate).toHaveBeenCalled();
    });

    it('returns false if no providers have an update or implement checkForUpdate', async () => {
      const providerWithoutCheck: UpdateProvider = {
        name: 'no-check',
        isAvailable: jest.fn().mockResolvedValue(true),
        triggerUpdate: jest.fn(),
      };
      const service = new UpdateService([providerWithoutCheck]);

      const result = await service.checkForUpdate({ source: 'manual' });
      expect(result).toBe(false);
    });
  });

  describe('checkForInstalledUpdate', () => {
    it('records current version without emitting event on fresh install', async () => {
      const mockStorage = {
        getLastInstalledVersion: jest.fn().mockResolvedValue(null),
        setLastInstalledVersion: jest.fn().mockResolvedValue(undefined),
      };
      const trackEventSpy = jest.spyOn(AnalyticsService, 'trackEvent');

      const service = new UpdateService();
      const updated = await service.checkForInstalledUpdate(mockStorage, () => '1.0.0');

      expect(updated).toBe(false);
      expect(mockStorage.setLastInstalledVersion).toHaveBeenCalledWith('1.0.0');
      expect(trackEventSpy).not.toHaveBeenCalledWith('update_installed', expect.anything());
    });

    it('emits update_installed event and updates storage when version changes', async () => {
      const mockStorage = {
        getLastInstalledVersion: jest.fn().mockResolvedValue('1.0.0'),
        setLastInstalledVersion: jest.fn().mockResolvedValue(undefined),
      };
      const trackEventSpy = jest.spyOn(AnalyticsService, 'trackEvent');

      const service = new UpdateService();
      const updated = await service.checkForInstalledUpdate(mockStorage, () => '1.1.0');

      expect(updated).toBe(true);
      expect(trackEventSpy).toHaveBeenCalledWith('update_installed', {
        status: 'installed',
        previous_version: '1.0.0',
        current_version: '1.1.0',
      });
      expect(mockStorage.setLastInstalledVersion).toHaveBeenCalledWith('1.1.0');
    });

    it('does not emit event or update storage when version is unchanged', async () => {
      const mockStorage = {
        getLastInstalledVersion: jest.fn().mockResolvedValue('1.1.0'),
        setLastInstalledVersion: jest.fn().mockResolvedValue(undefined),
      };
      const trackEventSpy = jest.spyOn(AnalyticsService, 'trackEvent');

      const service = new UpdateService();
      const updated = await service.checkForInstalledUpdate(mockStorage, () => '1.1.0');

      expect(updated).toBe(false);
      expect(trackEventSpy).not.toHaveBeenCalledWith('update_installed', expect.anything());
      expect(mockStorage.setLastInstalledVersion).not.toHaveBeenCalled();
    });
  });
});
