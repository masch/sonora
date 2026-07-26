import { render } from '@testing-library/react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

let mockExtra: {
  isProduction: boolean;
  appVersionName: string | undefined;
  appVersionCode: number | undefined;
} = {
  isProduction: true,
  appVersionName: '1.0.3',
  appVersionCode: 42,
};

let mockApp: {
  nativeApplicationVersion: string | null;
  nativeBuildVersion: string | null;
} = {
  nativeApplicationVersion: '1.0.3',
  nativeBuildVersion: '42',
};

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockApp.nativeApplicationVersion;
  },
  get nativeBuildVersion() {
    return mockApp.nativeBuildVersion;
  },
}));

jest.mock('expo-constants', () => ({
  get expoConfig() {
    return { extra: mockExtra };
  },
}));

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// react-native-reanimated, react-native-worklets already mocked in jest.setup.ts

describe('AnimatedSplashOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtra.appVersionName = '1.0.3';
    mockExtra.appVersionCode = 42;
    mockApp = {
      nativeApplicationVersion: '1.0.3',
      nativeBuildVersion: '42',
    };
  });

  it('renders version text when both expo-application values are set', async () => {
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('1.0.3 (42)')).toBeTruthy();
  });

  it('renders default version when nativeApplicationVersion is null', async () => {
    mockApp.nativeApplicationVersion = null;
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('0.0.0 (42)')).toBeTruthy();
  });

  it('renders default version when nativeBuildVersion is null', async () => {
    mockApp.nativeBuildVersion = null;
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('1.0.3 (0)')).toBeTruthy();
  });
});
