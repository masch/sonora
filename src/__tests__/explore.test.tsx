import React from 'react';
import { render } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock modules required by TripMap (native)
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
import ExploreScreen from '@/app/(tabs)/explore';

describe('Explore screen', () => {
  it('renders TripMap component', () => {
    const { getByText } = render(<ExploreScreen />);

    expect(getByText('Umepay Bosque Antiguo')).toBeTruthy();
    expect(getByText('map.tripsTitle')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ExploreScreen />);

    expect(toJSON()).not.toBeNull();
  });
});
