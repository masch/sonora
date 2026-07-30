import { DeviceService } from '../device-service';
import SqliteStorage from 'expo-sqlite/kv-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { generateUuid } from '@sonora/shared';
import * as Crypto from 'expo-crypto';

jest.mock('expo-sqlite/kv-store', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-application', () => ({
  getAndroidId: jest.fn(),
  getIosIdForVendorAsync: jest.fn(),
}));

jest.mock('@sonora/shared', () => ({
  DEVICE_ID_KEY: 'device_id_key',
  generateUuid: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(),
}));

const MOCK_HASH = 'abc123def456abc123def456abc123def456abc123def456abc123def4567890';

describe('DeviceService', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue(MOCK_HASH);
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  it('returns hashed android ID on android OS', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    (Application.getAndroidId as jest.Mock).mockReturnValue('mock-android-id');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe(MOCK_HASH);
    expect(Application.getAndroidId).toHaveBeenCalled();
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'mock-android-id',
    );
  });

  it('returns hashed ios ID on ios OS', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });
    (Application.getIosIdForVendorAsync as jest.Mock).mockResolvedValue('mock-ios-id');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe(MOCK_HASH);
    expect(Application.getIosIdForVendorAsync).toHaveBeenCalled();
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'mock-ios-id',
    );
  });

  it('hashes persisted UUID from SQLite when device ID is not available from OS', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    (Application.getAndroidId as jest.Mock).mockReturnValue(null);
    (SqliteStorage.getItem as jest.Mock).mockResolvedValue('persisted-sqlite-id');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe(MOCK_HASH);
    expect(SqliteStorage.getItem).toHaveBeenCalledWith('device_id_key');
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'persisted-sqlite-id',
    );
  });

  it('generates, persists, and hashes new UUID when SQLite storage is also empty', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });
    (Application.getIosIdForVendorAsync as jest.Mock).mockResolvedValue(null);
    (SqliteStorage.getItem as jest.Mock).mockResolvedValue(null);
    (generateUuid as jest.Mock).mockReturnValue('new-generated-uuid');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe(MOCK_HASH);
    expect(generateUuid).toHaveBeenCalled();
    expect(SqliteStorage.setItem).toHaveBeenCalledWith('device_id_key', 'new-generated-uuid');
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'new-generated-uuid',
    );
  });

  it('returns fallback string if an error occurs', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });
    (Application.getIosIdForVendorAsync as jest.Mock).mockRejectedValue(new Error('OS Error'));

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe('fallback-device-id');
  });

  it('ensures raw device ID is never exposed outside the function', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    (Application.getAndroidId as jest.Mock).mockReturnValue('sensitive-raw-id');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe(MOCK_HASH);
    expect(deviceId).not.toBe('sensitive-raw-id');
  });
});
