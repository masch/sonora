import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, Text, View, ScrollView } from 'react-native';

import { ScrollScreenWrapper } from '@/components/screen-wrapper';

jest.mock('@/tw', () => {
  const React = jest.requireActual('react');
  const { View: RNView, ScrollView: RNScrollView } = jest.requireActual('react-native');
  return {
    TwView: (props: Record<string, unknown>) => React.createElement(RNView, props, props.children),
    TwScrollView: (props: Record<string, unknown>) =>
      React.createElement(RNScrollView, props, props.children),
  };
});

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

  it('applies max-w-[800px] only on web when fullWidth is false', async () => {
    const originalOS = Platform.OS;
    try {
      Platform.OS = 'web';
      const { getByText } = await render(
        <ScrollScreenWrapper>
          <Text>Web Content</Text>
        </ScrollScreenWrapper>,
      );
      expect(getByText('Web Content').parent?.props.className).toContain('max-w-[800px]');
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('uses full width without max-w-[800px] on native platforms', async () => {
    const { getByText } = await render(
      <ScrollScreenWrapper>
        <Text>Native Content</Text>
      </ScrollScreenWrapper>,
    );
    expect(getByText('Native Content').parent?.props.className).toBe('w-full grow');
  });
});
