import SqliteStorage from 'expo-sqlite/kv-store';
import { getAcceptedTermsVersion, setAcceptedTermsVersion } from '@/storage/app-storage';

const mockKv = SqliteStorage as jest.Mocked<typeof SqliteStorage>;

describe('app-storage (terms and conditions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKv.getItem.mockResolvedValue(null);
    mockKv.setItem.mockResolvedValue(undefined);
  });

  describe('getAcceptedTermsVersion', () => {
    it('returns null when no version has been accepted', async () => {
      const version = await getAcceptedTermsVersion();
      expect(version).toBeNull();
      expect(mockKv.getItem).toHaveBeenCalledWith('terms_accepted_version');
    });

    it('returns the stored accepted version string', async () => {
      mockKv.getItem.mockResolvedValue('2026.09.1');
      const version = await getAcceptedTermsVersion();
      expect(version).toBe('2026.09.1');
    });

    it('handles storage read errors gracefully by returning null', async () => {
      mockKv.getItem.mockRejectedValue(new Error('Storage failure'));
      const version = await getAcceptedTermsVersion();
      expect(version).toBeNull();
    });
  });

  describe('setAcceptedTermsVersion', () => {
    it('persists the accepted version string to storage', async () => {
      await setAcceptedTermsVersion('2026.09.2');
      expect(mockKv.setItem).toHaveBeenCalledWith('terms_accepted_version', '2026.09.2');
    });

    it('rethrows storage write errors when persistence fails', async () => {
      mockKv.setItem.mockRejectedValue(new Error('Disk full'));
      await expect(setAcceptedTermsVersion('2026.09.2')).rejects.toThrow('Disk full');
    });
  });
});
