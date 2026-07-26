import { render } from '@testing-library/react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

let mockApp: {
  nativeApplicationVersion: string | null;
} = {
  nativeApplicationVersion: '1.0.3',
};

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockApp.nativeApplicationVersion;
  },
}));

jest.mock('expo-constants', () => ({
  get expoConfig() {
    return { extra: { isProduction: true } };
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
    mockApp = { nativeApplicationVersion: '1.0.3' };
  });

  it('renders version text when native version is set', async () => {
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('1.0.3')).toBeTruthy();
  });

  it('renders default version when nativeApplicationVersion is null', async () => {
    mockApp.nativeApplicationVersion = null;
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('0.0.0')).toBeTruthy();
  });
});
