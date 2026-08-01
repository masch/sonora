jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { render } from '@testing-library/react-native';

import PreparingAudioHint from '@/components/preparing-audio-hint';

describe('PreparingAudioHint', () => {
  it('renders the hint with its testID', async () => {
    const { getByTestId } = await render(<PreparingAudioHint />);
    expect(getByTestId('preparing-audio-hint')).toBeTruthy();
  });

  it('translates the preparing-audio label', async () => {
    const { getByText } = await render(<PreparingAudioHint />);
    expect(getByText('experiences.geofenceBlocked.preparingAudio')).toBeTruthy();
  });
});
