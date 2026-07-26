import { render } from '@testing-library/react-native';

import { WebBadge } from '@/components/web-badge';

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.3',
    },
  },
  expoConfig: {
    version: '1.0.3',
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
  });

  it('renders app version when Constants.expoConfig.version is set', async () => {
    const { getByText } = await render(<WebBadge />);
    expect(getByText('1.0.3')).toBeTruthy();
  });

  it('does not render app version when Constants.expoConfig.version is null', async () => {
    const Constants = require('expo-constants');
    Constants.default.expoConfig.version = null;
    Constants.expoConfig.version = null;

    const { queryByText } = await render(<WebBadge />);
    expect(queryByText('1.0.3')).toBeNull();
  });
});
