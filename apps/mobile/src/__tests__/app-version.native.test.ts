import { getAppVersion } from '@/utils/app-version.native';

let mockApp: {
  nativeApplicationVersion: string | null;
} = {
  nativeApplicationVersion: '1.0.119',
};

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockApp.nativeApplicationVersion;
  },
}));

describe('getAppVersion (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApp = {
      nativeApplicationVersion: '1.0.119',
    };
  });

  it('returns version from expo-application when available', () => {
    const result = getAppVersion();
    expect(result.versionName).toBe('1.0.119');
    expect(result.formatted).toBe('1.0.119');
  });

  it('defaults versionName to 0.0.0 when nativeApplicationVersion is null', () => {
    mockApp.nativeApplicationVersion = null;

    const result = getAppVersion();
    expect(result.versionName).toBe('0.0.0');
    expect(result.formatted).toBe('0.0.0');
  });

  it('defaults versionName to 0.0.0 when nativeApplicationVersion is empty string', () => {
    mockApp.nativeApplicationVersion = '';

    const result = getAppVersion();
    expect(result.versionName).toBe('0.0.0');
    expect(result.formatted).toBe('0.0.0');
  });
});
