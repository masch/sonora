import { DeviceService } from '../device-service';
import SqliteStorage from 'expo-sqlite/kv-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { generateUuid } from '@sonora/shared';

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

describe('DeviceService', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  it('returns android ID on android OS', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    (Application.getAndroidId as jest.Mock).mockReturnValue('mock-android-id');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe('mock-android-id');
    expect(Application.getAndroidId).toHaveBeenCalled();
  });

  it('returns ios ID on ios OS', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });
    (Application.getIosIdForVendorAsync as jest.Mock).mockResolvedValue('mock-ios-id');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe('mock-ios-id');
    expect(Application.getIosIdForVendorAsync).toHaveBeenCalled();
  });

  it('falls back to SQLite storage when device ID is not available from OS', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    (Application.getAndroidId as jest.Mock).mockReturnValue(null);
    (SqliteStorage.getItem as jest.Mock).mockResolvedValue('persisted-sqlite-id');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe('persisted-sqlite-id');
    expect(SqliteStorage.getItem).toHaveBeenCalledWith('device_id_key');
  });

  it('generates and persists new UUID when SQLite storage is also empty', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });
    (Application.getIosIdForVendorAsync as jest.Mock).mockResolvedValue(null);
    (SqliteStorage.getItem as jest.Mock).mockResolvedValue(null);
    (generateUuid as jest.Mock).mockReturnValue('new-generated-uuid');

    const deviceId = await DeviceService.getPlatformDeviceId();
    expect(deviceId).toBe('new-generated-uuid');
    expect(generateUuid).toHaveBeenCalled();
    expect(SqliteStorage.setItem).toHaveBeenCalledWith('device_id_key', 'new-generated-uuid');
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
});
