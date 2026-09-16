import { Platform } from 'react-native';
import { getStoreUrls, getPlayStoreUrl } from '../store-url';

jest.mock('expo-application', () => ({
  applicationId: 'org.sonoraderivapoeticas.app',
}));

describe('store-url', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  describe('Android platform', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
    });

    it('returns market:// scheme as primary and play.google.com as fallback', () => {
      const urls = getStoreUrls();
      expect(urls.primary).toBe('market://details?id=org.sonoraderivapoeticas.app');
      expect(urls.fallback).toBe(
        'https://play.google.com/store/apps/details?id=org.sonoraderivapoeticas.app',
      );
    });

    it('supports custom appId override', () => {
      const urls = getStoreUrls('com.custom.app');
      expect(urls.primary).toBe('market://details?id=com.custom.app');
      expect(urls.fallback).toBe('https://play.google.com/store/apps/details?id=com.custom.app');
    });
  });

  describe('iOS platform', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });
    });

    it('returns configured default numeric App Store ID when no override provided', () => {
      const urls = getStoreUrls();
      expect(urls.primary).toBe('itms-apps://apps.apple.com/app/id0000000000');
      expect(urls.fallback).toBe('https://apps.apple.com/app/id0000000000');
    });

    it('returns itms-apps as primary and apps.apple.com as fallback with custom appId override', () => {
      const urls = getStoreUrls('123456789');
      expect(urls.primary).toBe('itms-apps://apps.apple.com/app/id123456789');
      expect(urls.fallback).toBe('https://apps.apple.com/app/id123456789');
    });
  });

  describe('Web / Fallback platform', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
        configurable: true,
      });
    });

    it('returns web preview fallback url', () => {
      const urls = getStoreUrls();
      expect(urls.primary).toContain('https://');
      expect(urls.fallback).toBeUndefined();
    });
  });

  describe('getPlayStoreUrl', () => {
    it('returns direct Google Play Store web URL with default package', () => {
      expect(getPlayStoreUrl()).toBe(
        'https://play.google.com/store/apps/details?id=org.sonoraderivapoeticas.app',
      );
    });

    it('supports custom package override', () => {
      expect(getPlayStoreUrl('com.other.app')).toBe(
        'https://play.google.com/store/apps/details?id=com.other.app',
      );
    });
  });
});
