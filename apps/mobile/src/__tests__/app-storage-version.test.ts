import SqliteStorage from 'expo-sqlite/kv-store';
import { getLastInstalledVersion, setLastInstalledVersion } from '@/storage/app-storage';

const mockKv = SqliteStorage as jest.Mocked<typeof SqliteStorage>;

describe('app-storage (installed version)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKv.getItem.mockResolvedValue(null);
    mockKv.setItem.mockResolvedValue(undefined);
  });

  describe('getLastInstalledVersion', () => {
    it('returns null when no version has been stored', async () => {
      const version = await getLastInstalledVersion();
      expect(version).toBeNull();
      expect(mockKv.getItem).toHaveBeenCalledWith('last_installed_version');
    });

    it('returns the stored version string', async () => {
      mockKv.getItem.mockResolvedValue('1.2.0');
      const version = await getLastInstalledVersion();
      expect(version).toBe('1.2.0');
    });

    it('handles storage read errors gracefully by returning null', async () => {
      mockKv.getItem.mockRejectedValue(new Error('Storage failure'));
      const version = await getLastInstalledVersion();
      expect(version).toBeNull();
    });
  });

  describe('setLastInstalledVersion', () => {
    it('persists the version string to storage', async () => {
      await setLastInstalledVersion('1.3.0');
      expect(mockKv.setItem).toHaveBeenCalledWith('last_installed_version', '1.3.0');
    });

    it('rethrows storage write errors when persistence fails', async () => {
      mockKv.setItem.mockRejectedValue(new Error('Disk full'));
      await expect(setLastInstalledVersion('1.3.0')).rejects.toThrow('Disk full');
    });
  });
});
