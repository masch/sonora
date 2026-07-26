import { render } from '@testing-library/react-native';

import { WebBadge } from '@/components/web-badge';

let mockConstants: {
  expoConfig: { version: string | null };
  default: { expoConfig: { version: string | null } };
} = {
  default: {
    expoConfig: {
      version: '1.0.3',
    },
  },
  expoConfig: {
    version: '1.0.3',
  },
};

jest.mock('expo-constants', () => ({
  get default() {
    return mockConstants.default;
  },
  get expoConfig() {
    return mockConstants.expoConfig;
  },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => ({ isDark: false }),
}));

jest.mock('@/constants/images', () => ({
  EXPO_BADGE: 'expo-badge-light',
  EXPO_BADGE_WHITE: 'expo-badge-dark',
}));

describe('WebBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.default.expoConfig.version = '1.0.3';
    mockConstants.expoConfig.version = '1.0.3';
  });

  it('renders app version when Constants.expoConfig.version is set', async () => {
    const { getByText } = await render(<WebBadge />);
    expect(getByText('1.0.3')).toBeTruthy();
  });

  it('does not render app version when Constants.expoConfig.version is null', async () => {
    mockConstants.default.expoConfig.version = null;
    mockConstants.expoConfig.version = null;

    const { queryByText } = await render(<WebBadge />);
    expect(queryByText('1.0.3')).toBeNull();
  });
});
