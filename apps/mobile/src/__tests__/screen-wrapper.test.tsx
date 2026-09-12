import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ScrollScreenWrapper } from '@/components/screen-wrapper';

jest.mock('@/store/audio-player-store', () => ({
  useAudioPlayerStore: jest.fn((selector) =>
    selector({
      status: 'idle',
      currentUri: null,
    }),
  ),
}));

describe('ScrollScreenWrapper', () => {
  it('renders children within centered container', async () => {
    const { getByText } = await render(
      <ScrollScreenWrapper>
        <Text>Test Screen Content</Text>
      </ScrollScreenWrapper>,
    );

    expect(getByText('Test Screen Content')).toBeTruthy();
  });

  it('renders with fullWidth when specified', async () => {
    const { getByText } = await render(
      <ScrollScreenWrapper fullWidth>
        <Text>Full Width Content</Text>
      </ScrollScreenWrapper>,
    );

    expect(getByText('Full Width Content')).toBeTruthy();
  });

  it('renders with background image', async () => {
    const mockImage = { uri: 'https://example.com/bg.png' };
    const { getByText } = await render(
      <ScrollScreenWrapper backgroundImage={mockImage}>
        <Text>Content with BG</Text>
      </ScrollScreenWrapper>,
    );

    expect(getByText('Content with BG')).toBeTruthy();
  });
});
