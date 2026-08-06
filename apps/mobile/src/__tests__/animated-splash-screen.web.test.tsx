import { render } from '@testing-library/react-native';
import React from 'react';

import { AnimatedSplashOverlay, AnimatedIcon } from '@/components/animated-icon.web';

let mockIsProduction = true;

jest.mock('expo-constants', () => ({
  get expoConfig() {
    return { extra: { isProduction: mockIsProduction } };
  },
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.3',
}));

describe('AnimatedSplashOverlay Web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsProduction = true;
  });

  it('renders web splash overlay in production mode', async () => {
    const { getByText } = await render(<AnimatedSplashOverlay isReady={true} />);
    expect(getByText('1.0.3')).toBeTruthy();
  });

  it('renders web splash overlay in staging mode', async () => {
    mockIsProduction = false;
    const { getByText } = await render(<AnimatedSplashOverlay isReady={true} />);
    expect(getByText('1.0.3')).toBeTruthy();
  });

  it('renders web AnimatedIcon component', async () => {
    const { toJSON } = await render(<AnimatedIcon />);
    expect(toJSON()).not.toBeNull();
  });
});
