import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { GeofenceBlockedModal } from '@/components/geofence-blocked-modal';

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

describe('GeofenceBlockedModal', () => {
  it('renders modal when visible is true and handles dismiss on button click', async () => {
    const onDismiss = jest.fn();
    const { getByTestId } = await render(
      <GeofenceBlockedModal
        visible={true}
        onDismiss={onDismiss}
        requiredRadiusMeters={50}
        distanceMeters={150}
      />,
    );

    expect(getByTestId('mock-bottom-modal')).toBeTruthy();

    const okButton = getByTestId('geofence-blocked-alert-ok');
    await fireEvent.press(okButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders null when visible is false', async () => {
    const { queryByTestId } = await render(
      <GeofenceBlockedModal
        visible={false}
        onDismiss={jest.fn()}
        requiredRadiusMeters={50}
        distanceMeters={null}
      />,
    );

    expect(queryByTestId('mock-bottom-modal')).toBeNull();
  });
});
