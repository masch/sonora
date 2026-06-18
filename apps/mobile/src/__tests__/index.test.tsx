import React from 'react';
import { render } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock modules required by TripMap (now rendered in index.tsx)
// ---------------------------------------------------------------------------

jest.mock('@/data/trips', () => ({
  getAllTrips: jest.fn(() => [
    {
      id: 'umepay-bosque',
      title: 'Umepay Bosque Antiguo',
      description: 'A meditative walk through the ancient forest.',
      durationMinutes: 45,
      startCoordinates: { latitude: -32.212, longitude: -64.738 },
      audioRemoteUrl: 'https://example.com/audio.mp3',
    },
  ]),
}));

const mockPush = jest.fn();
const MockLink = ({ children, testID, ...props }: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  return (
    <RN.TouchableOpacity testID={testID} onPress={() => mockPush(props.href)}>
      {children}
    </RN.TouchableOpacity>
  );
};
jest.mock('expo-router', () => ({
  Link: MockLink,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({ t: (k: string) => k }),
}));

// Import after mocks
import HomeScreen from '@/app/(tabs)/index';

describe('Home screen (Redesigned)', () => {
  it('renders home layout elements and menu items', () => {
    const { getByText, getByTestId } = render(<HomeScreen />);

    expect(getByText('home.title')).toBeTruthy();
    expect(getByText('home.poetic')).toBeTruthy();
    expect(getByText('home.continueListening')).toBeTruthy();
    expect(getByText('home.exploreTrips')).toBeTruthy();
    expect(getByText('home.exploreTracks')).toBeTruthy();
    expect(getByText('home.localMessages')).toBeTruthy();

    expect(getByTestId('continue-listening-card')).toBeTruthy();
    expect(getByTestId('explore-trips-menu')).toBeTruthy();
    expect(getByTestId('explore-tracks-menu')).toBeTruthy();
    expect(getByTestId('local-messages-menu')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<HomeScreen />);

    expect(toJSON()).not.toBeNull();
  });
});
