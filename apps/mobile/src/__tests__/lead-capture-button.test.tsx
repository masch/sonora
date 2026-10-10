import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import { LeadCaptureButton } from '@/components/lead-capture-button';

jest.mock('@/components/lead-capture-modal', () => {
  const mockReact = require('react');
  const { View, Pressable } = require('react-native');
  return {
    LeadCaptureModal: ({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) =>
      visible
        ? mockReact.createElement(
            View,
            { testID: 'mock-lead-modal' },
            mockReact.createElement(Pressable, {
              testID: 'mock-lead-dismiss',
              onPress: onDismiss,
              accessibilityLabel: 'mock-dismiss',
            }),
          )
        : null,
  };
});

const mockMap: Record<string, string> = {
  'leadCapture.button': 'Contact',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

describe('LeadCaptureButton', () => {
  it('renders button and toggles modal visibility on press', async () => {
    const { getByTestId, queryByTestId } = await render(
      <LeadCaptureButton
        source="track_detail"
        experienceId="123e4567-e89b-12d3-a456-426614174000"
      />,
    );

    const button = getByTestId('lead-capture-open-button');
    expect(button).toBeTruthy();
    expect(queryByTestId('mock-lead-modal')).toBeNull();

    await fireEvent.press(button);

    expect(queryByTestId('mock-lead-modal')).toBeTruthy();

    await fireEvent.press(getByTestId('mock-lead-dismiss'));

    expect(queryByTestId('mock-lead-modal')).toBeNull();
  });
});
