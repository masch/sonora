import { getAppVersion } from '@/utils/app-version.ts';

let mockExtra: {
  appVersionName: string | undefined;
  appVersionCode: number | undefined;
} = {
  appVersionName: '1.0.3',
  appVersionCode: 42,
};

jest.mock('expo-constants', () => ({
  get expoConfig() {
    return { extra: mockExtra };
  },
}));

describe('getAppVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtra = {
      appVersionName: '1.0.3',
      appVersionCode: 42,
    };
  });

  it('returns version name and code from extra', () => {
    const result = getAppVersion();
    expect(result.versionName).toBe('1.0.3');
    expect(result.versionCode).toBe(42);
    expect(result.formatted).toBe('1.0.3 (42)');
  });

  it('defaults versionName to 0.0.0 when undefined', () => {
    mockExtra.appVersionName = undefined;

    const result = getAppVersion();
    expect(result.versionName).toBe('0.0.0');
    expect(result.versionCode).toBe(42);
    expect(result.formatted).toBe('0.0.0 (42)');
  });

  it('defaults versionCode to 0 when undefined', () => {
    mockExtra.appVersionCode = undefined;

    const result = getAppVersion();
    expect(result.versionName).toBe('1.0.3');
    expect(result.versionCode).toBe(0);
    expect(result.formatted).toBe('1.0.3 (0)');
  });

  it('defaults both when extra is undefined', () => {
    mockExtra = undefined as unknown as typeof mockExtra;

    const result = getAppVersion();
    expect(result.versionName).toBe('0.0.0');
    expect(result.versionCode).toBe(0);
    expect(result.formatted).toBe('0.0.0 (0)');
  });
});
