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
  });

  it('renders version text when extra has version info', async () => {
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('1.0.3 (42)')).toBeTruthy();
  });

  it('renders default version text when appVersionName is missing', async () => {
    mockExtra.appVersionName = undefined;
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('0.0.0 (42)')).toBeTruthy();
  });

  it('renders default version text when appVersionCode is missing', async () => {
    mockExtra.appVersionCode = undefined;
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('1.0.3 (0)')).toBeTruthy();
  });
});
