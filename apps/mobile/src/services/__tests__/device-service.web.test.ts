import { DeviceService } from '../device-service.web';
import { generateUuid, sha256 } from '@sonora/shared';
import { logger } from '@/utils/logger';

jest.mock('@sonora/shared', () => ({
  DEVICE_ID_KEY: 'device_id_key',
  generateUuid: jest.fn(),
  sha256: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const MOCK_HASH = 'abc123def456abc123def456abc123def456abc123def456abc123def4567890';

describe('DeviceService (Web)', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    (sha256 as jest.Mock).mockResolvedValue(MOCK_HASH);
    const store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
      }),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('returns hashed device ID from localStorage if present', async () => {
    localStorage.setItem('device_id_key', 'stored-web-uuid');

    const result = await DeviceService.getPlatformDeviceId();
    expect(result).toBe(MOCK_HASH);
    expect(localStorage.getItem).toHaveBeenCalledWith('device_id_key');
    expect(sha256).toHaveBeenCalledWith('stored-web-uuid');
  });

  it('generates, persists, and returns hashed UUID if not present in localStorage', async () => {
    (generateUuid as jest.Mock).mockReturnValue('new-web-uuid');

    const result = await DeviceService.getPlatformDeviceId();
    expect(result).toBe(MOCK_HASH);
    expect(generateUuid).toHaveBeenCalled();
    expect(localStorage.setItem).toHaveBeenCalledWith('device_id_key', 'new-web-uuid');
    expect(sha256).toHaveBeenCalledWith('new-web-uuid');
  });

  it('logs error and returns fallback ID if localStorage throws exception', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: jest.fn(() => {
          throw new Error('Storage disabled');
        }),
      },
      writable: true,
      configurable: true,
    });

    const result = await DeviceService.getPlatformDeviceId();
    expect(result).toBe('fallback-web-device-id');
    expect(logger.error).toHaveBeenCalled();
  });
});
