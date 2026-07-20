import { DeviceService } from '../device-service.web';
import { generateUuid } from '@sonora/shared';
import { logger } from '@/utils/logger';

jest.mock('@sonora/shared', () => ({
  DEVICE_ID_KEY: 'device_id_key',
  generateUuid: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('DeviceService (Web)', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('returns device ID from localStorage if present', async () => {
    localStorage.setItem('device_id_key', 'stored-web-uuid');

    const result = await DeviceService.getPlatformDeviceId();
    expect(result).toBe('stored-web-uuid');
    expect(localStorage.getItem).toHaveBeenCalledWith('device_id_key');
  });

  it('generates, persists, and returns new UUID if not present in localStorage', async () => {
    (generateUuid as jest.Mock).mockReturnValue('new-web-uuid');

    const result = await DeviceService.getPlatformDeviceId();
    expect(result).toBe('new-web-uuid');
    expect(generateUuid).toHaveBeenCalled();
    expect(localStorage.setItem).toHaveBeenCalledWith('device_id_key', 'new-web-uuid');
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
