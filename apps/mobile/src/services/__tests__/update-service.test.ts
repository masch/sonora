import { Linking } from 'react-native';
import { UpdateService, DeepLinkUpdateProvider, type UpdateProvider } from '../update-service';
import * as storeUrlModule from '../store-url';

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

      const { Platform } = require('react-native');
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
  });
});
