import { getAppVersion } from '@/utils/app-version.native';

let mockApp: {
  nativeApplicationVersion: string | null;
  nativeBuildVersion: string | null;
} = {
  nativeApplicationVersion: '1.0.119',
  nativeBuildVersion: '124',
};

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockApp.nativeApplicationVersion;
  },
  get nativeBuildVersion() {
    return mockApp.nativeBuildVersion;
  },
}));

describe('getAppVersion (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApp = {
      nativeApplicationVersion: '1.0.119',
      nativeBuildVersion: '124',
    };
  });

  it('returns version from expo-application when available', () => {
    const result = getAppVersion();
    expect(result.versionName).toBe('1.0.119');
    expect(result.versionCode).toBe(124);
    expect(result.formatted).toBe('1.0.119 (124)');
  });

  it('defaults versionName to 0.0.0 when nativeApplicationVersion is null', () => {
    mockApp.nativeApplicationVersion = null;

    const result = getAppVersion();
    expect(result.versionName).toBe('0.0.0');
    expect(result.versionCode).toBe(124);
    expect(result.formatted).toBe('0.0.0 (124)');
  });

  it('defaults versionCode to 0 when nativeBuildVersion is null', () => {
    mockApp.nativeBuildVersion = null;

    const result = getAppVersion();
    expect(result.versionName).toBe('1.0.119');
    expect(result.versionCode).toBe(0);
    expect(result.formatted).toBe('1.0.119 (0)');
  });
});
