import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import ReferenceCard from '@/components/reference-card';
import type { MapReferencePress } from '@/components/map/map-view.types';

// The card's content is what this suite pins; the modal shell has its own suite.
jest.mock('@/components/ui/bottom-modal', () => {
  const React = jest.requireActual('react');
  const { View, Text } = jest.requireActual('react-native');
  return {
    BottomModal: ({
      visible,
      title,
      footer,
      children,
    }: {
      visible: boolean;
      title: string;
      footer: React.ReactNode;
      children: React.ReactNode;
    }) =>
      visible ? (
        <View testID="mock-bottom-modal">
          <Text testID="modal-title">{title}</Text>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

const reference: MapReferencePress = {
  documentKey: 'referencias',
  label: 'Centro Umepay',
  labelKey: 'map.centroUmepay.title',
  descriptionKey: 'map.centroUmepay.description',
  imageUrl: 'https://api.sonora.example/media/public/reference-images/a.png',
  linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
};

describe('ReferenceCard', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  it('renders the tapped reference with its label, description, image and action', async () => {
    const { getByTestId, getByText } = await render(
      <ReferenceCard reference={reference} onDismiss={jest.fn()} />,
    );

    expect(getByText('Centro Umepay')).toBeTruthy();
    // Missing translations render the key itself instead of hiding the content.
    expect(getByText('map.centroUmepay.description')).toBeTruthy();
    expect(getByTestId('reference-card-image')).toBeTruthy();
    expect(getByTestId('reference-card-link')).toBeTruthy();
  });

  it('opens the reference link when the action is pressed', async () => {
    const { getByTestId } = await render(
      <ReferenceCard reference={reference} onDismiss={jest.fn()} />,
    );

    await fireEvent.press(getByTestId('reference-card-link'));

    expect(openURL).toHaveBeenCalledWith('https://www.instagram.com/sonora.derivapoetica');
  });

  it('offers no action for a link outside the allowlist', async () => {
    const { queryByTestId } = await render(
      <ReferenceCard
        reference={{ ...reference, linkUrl: 'https://evil.example.com/x' }}
        onDismiss={jest.fn()}
      />,
    );

    expect(queryByTestId('reference-card-link')).toBeNull();
  });

  it('translates the label key when the drawn label is missing', async () => {
    const { getByTestId } = await render(
      <ReferenceCard reference={{ ...reference, label: undefined }} onDismiss={jest.fn()} />,
    );

    expect(getByTestId('modal-title').props.children).toBe('map.centroUmepay.title');
  });

  it('renders nothing until a reference is tapped', async () => {
    const { queryByTestId } = await render(
      <ReferenceCard reference={null} onDismiss={jest.fn()} />,
    );

    expect(queryByTestId('mock-bottom-modal')).toBeNull();
  });
});
