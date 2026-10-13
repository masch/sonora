import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

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

let mockPlayerState = {
  status: 'idle',
  currentUri: null as string | null,
};

jest.mock('@/store/audio-player-store', () => ({
  useAudioPlayerStore: jest.fn((selector) => selector(mockPlayerState)),
}));

describe('ScrollScreenWrapper', () => {
  beforeEach(() => {
    mockPlayerState = {
      status: 'idle',
      currentUri: null,
    };
  });

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

  it('renders with background image and custom classes', async () => {
    const mockImage = { uri: 'https://example.com/bg.png' };
    const { getByText } = await render(
      <ScrollScreenWrapper
        backgroundImage={mockImage}
        className="custom-class"
        contentContainerClassName="content-class"
      >
        <Text>Content with BG and custom classes</Text>
      </ScrollScreenWrapper>,
    );

    expect(getByText('Content with BG and custom classes')).toBeTruthy();
  });

  it('renders with background image without custom content container class', async () => {
    const mockImage = { uri: 'https://example.com/bg.png' };
    const { getByText } = await render(
      <ScrollScreenWrapper backgroundImage={mockImage}>
        <Text>Content with BG only</Text>
      </ScrollScreenWrapper>,
    );

    expect(getByText('Content with BG only')).toBeTruthy();
  });

  it('renders without background image but with custom classes', async () => {
    const { getByText } = await render(
      <ScrollScreenWrapper className="custom-scroll" contentContainerClassName="custom-content">
        <Text>Custom Class Content</Text>
      </ScrollScreenWrapper>,
    );

    expect(getByText('Custom Class Content')).toBeTruthy();
  });

  it('renders with withTabBar false and disableBottomPadding true', async () => {
    const { getByText } = await render(
      <ScrollScreenWrapper withTabBar={false} disableBottomPadding>
        <Text>No tab bar content</Text>
      </ScrollScreenWrapper>,
    );

    expect(getByText('No tab bar content')).toBeTruthy();
  });

  it('applies player bottom padding when playing on iOS', async () => {
    const originalOS = Platform.OS;
    try {
      Platform.OS = 'ios';
      mockPlayerState = {
        status: 'playing',
        currentUri: 'file://track.mp3',
      };

      const { getByText } = await render(
        <ScrollScreenWrapper withTabBar={true}>
          <Text>Playing iOS Content</Text>
        </ScrollScreenWrapper>,
      );

      expect(getByText('Playing iOS Content')).toBeTruthy();
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('applies player bottom padding when paused on Android', async () => {
    const originalOS = Platform.OS;
    try {
      Platform.OS = 'android';
      mockPlayerState = {
        status: 'paused',
        currentUri: 'file://track.mp3',
      };

      const { getByText } = await render(
        <ScrollScreenWrapper withTabBar={true}>
          <Text>Paused Android Content</Text>
        </ScrollScreenWrapper>,
      );

      expect(getByText('Paused Android Content')).toBeTruthy();
    } finally {
      Platform.OS = originalOS;
    }
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
