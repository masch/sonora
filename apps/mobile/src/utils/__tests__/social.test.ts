import { Linking, Platform } from 'react-native';
import { openInstagramProfile, sanitizeInstagramHandle } from '../social';

describe('social utilities', () => {
  describe('sanitizeInstagramHandle', () => {
    it('returns clean handle when no @ prefix', () => {
      expect(sanitizeInstagramHandle('sonora.derivapoetica')).toBe('sonora.derivapoetica');
    });

    it('strips leading @ symbol', () => {
      expect(sanitizeInstagramHandle('@sonora.derivapoetica')).toBe('sonora.derivapoetica');
    });

    it('trims whitespace', () => {
      expect(sanitizeInstagramHandle('  @sonora.derivapoetica  ')).toBe('sonora.derivapoetica');
    });

    it('returns empty string for empty input', () => {
      expect(sanitizeInstagramHandle('')).toBe('');
      expect(sanitizeInstagramHandle('@')).toBe('');
    });
  });

  describe('openInstagramProfile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('opens native app url first', async () => {
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

      await openInstagramProfile('sonora.derivapoetica');

      expect(openSpy).toHaveBeenCalledWith('instagram://user?username=sonora.derivapoetica');
      expect(openSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to web url when native app open fails', async () => {
      const openSpy = jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValueOnce(new Error('App not installed'))
        .mockResolvedValueOnce(true as never);

      await openInstagramProfile('@sonora.derivapoetica');

      expect(openSpy).toHaveBeenNthCalledWith(1, 'instagram://user?username=sonora.derivapoetica');
      expect(openSpy).toHaveBeenNthCalledWith(2, 'https://instagram.com/sonora.derivapoetica');
    });

    it('opens web url directly on web platform without trying deep link', async () => {
      const originalPlatform = Platform.OS;
      Platform.OS = 'web';
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

      try {
        await openInstagramProfile('sonora.derivapoetica');
        expect(openSpy).toHaveBeenCalledWith('https://instagram.com/sonora.derivapoetica');
        expect(openSpy).toHaveBeenCalledTimes(1);
      } finally {
        Platform.OS = originalPlatform;
      }
    });

    it('does nothing when handle is empty', async () => {
      const openSpy = jest.spyOn(Linking, 'openURL');

      await openInstagramProfile('');

      expect(openSpy).not.toHaveBeenCalled();
    });
  });
});
