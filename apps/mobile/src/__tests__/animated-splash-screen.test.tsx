import { render } from '@testing-library/react-native';

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

let mockIsProduction = true;

jest.mock('expo-constants', () => ({
  get expoConfig() {
    return { extra: { isProduction: mockIsProduction } };
  },
}));

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// react-native-reanimated, react-native-worklets already mocked in jest.setup.ts

import { AnimatedSplashOverlay, AnimatedIcon } from '@/components/animated-icon';

describe('AnimatedSplashOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsProduction = true;
    mockApp = { nativeApplicationVersion: '1.0.3' };
  });

  it('renders version text when native version is set', async () => {
    const { getByText } = await render(<AnimatedSplashOverlay isReady={true} />);
    expect(getByText('1.0.3')).toBeTruthy();
  });

  it('renders default version when nativeApplicationVersion is null', async () => {
    mockApp.nativeApplicationVersion = null;
    const { getByText } = await render(<AnimatedSplashOverlay isReady={true} />);
    expect(getByText('0.0.0')).toBeTruthy();
  });

  it('renders splash overlay in staging mode', async () => {
    mockIsProduction = false;
    const { getByText } = await render(<AnimatedSplashOverlay isReady={true} />);
    expect(getByText('1.0.3')).toBeTruthy();
  });

  it('renders AnimatedIcon component', async () => {
    const { toJSON } = await render(<AnimatedIcon />);
    expect(toJSON()).not.toBeNull();
  });
});
