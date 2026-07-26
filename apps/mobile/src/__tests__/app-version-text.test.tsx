import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { AppVersionText } from '@/components/app-version-text';

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

describe('AppVersionText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtra.appVersionName = '1.0.3';
    mockExtra.appVersionCode = 42;
  });

  it('renders version text on web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const { getByText } = await render(<AppVersionText />);
    expect(getByText('1.0.3 (42)')).toBeTruthy();
  });

  it('renders default version when extra is missing appVersionName', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    mockExtra.appVersionName = undefined;
    const { getByText } = await render(<AppVersionText />);
    expect(getByText('0.0.0 (42)')).toBeTruthy();
  });

  it('renders default version when extra is missing appVersionCode', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    mockExtra.appVersionCode = undefined;
    const { getByText } = await render(<AppVersionText />);
    expect(getByText('1.0.3 (0)')).toBeTruthy();
  });
});
