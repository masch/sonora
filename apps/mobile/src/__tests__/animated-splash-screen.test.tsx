import { render } from '@testing-library/react-native';
import * as Application from 'expo-application';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

// Mock native modules used by animated-icon.tsx
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.3',
  nativeBuildVersion: '42',
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      isProduction: true,
    },
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
  });

  it('renders version text when both version and build are present', async () => {
    const { getByText } = await render(<AnimatedSplashOverlay />);
    expect(getByText('1.0.3 (42)')).toBeTruthy();
  });

  it('does not render version text when nativeApplicationVersion is null', async () => {
    (Application as unknown as Record<string, unknown>).nativeApplicationVersion = null;
    const { queryByText } = await render(<AnimatedSplashOverlay />);
    expect(queryByText(/1\.0\.3|42/)).toBeNull();
  });

  it('does not render version text when nativeBuildVersion is null', async () => {
    (Application as unknown as Record<string, unknown>).nativeBuildVersion = null;
    const { queryByText } = await render(<AnimatedSplashOverlay />);
    expect(queryByText(/1\.0\.3|42/)).toBeNull();
  });
});
