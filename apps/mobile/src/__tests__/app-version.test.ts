import { getAppVersion } from '@/utils/app-version.ts';

let mockConfig: {
  extra?: { appVersionName: string };
} | null = {
  extra: { appVersionName: '1.0.3' },
};

jest.mock('expo-constants', () => ({
  get expoConfig() {
    return mockConfig;
  },
}));

describe('getAppVersion (web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = { extra: { appVersionName: '1.0.3' } };
  });

  it('returns version name from extra', () => {
    const result = getAppVersion();
    expect(result.versionName).toBe('1.0.3');
    expect(result.formatted).toBe('1.0.3');
  });

  it('defaults versionName to 0.0.0 when undefined', () => {
    mockConfig = { extra: { appVersionName: undefined as unknown as string } };

    const result = getAppVersion();
    expect(result.versionName).toBe('0.0.0');
    expect(result.formatted).toBe('0.0.0');
  });

  it('defaults versionName to 0.0.0 when extra is undefined', () => {
    mockConfig = {};

    const result = getAppVersion();
    expect(result.versionName).toBe('0.0.0');
    expect(result.formatted).toBe('0.0.0');
  });
});
