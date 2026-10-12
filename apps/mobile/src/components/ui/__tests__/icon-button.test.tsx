import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { IconButton } from '@/components/ui/icon-button';

describe('IconButton', () => {
  it('renders and calls onPress', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <IconButton
        onPress={onPress}
        testID="test-icon-btn"
        accessibilityLabel="Close"
        icon={{ ios: 'xmark', android: 'close', web: 'close' }}
      />,
    );

    const btn = getByTestId('test-icon-btn');
    expect(btn).toBeTruthy();
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onPress when disabled', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <IconButton
        onPress={onPress}
        disabled
        testID="test-disabled-icon-btn"
        accessibilityLabel="Disabled"
        iconName="play"
      />,
    );

    await fireEvent.press(getByTestId('test-disabled-icon-btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading', async () => {
    const { getByTestId } = await render(
      <IconButton
        onPress={jest.fn()}
        loading
        testID="test-loading-icon-btn"
        accessibilityLabel="Loading"
        iconName="play"
      />,
    );

    expect(getByTestId('test-loading-icon-btn-spinner')).toBeTruthy();
  });

  it('renders with warning variant', async () => {
    const { getByTestId } = await render(
      <IconButton
        onPress={jest.fn()}
        variant="warning"
        testID="test-warning-icon-btn"
        accessibilityLabel="Warning"
        iconName="pause"
      />,
    );

    expect(getByTestId('test-warning-icon-btn')).toBeTruthy();
  });

  it('handles empty icon and custom hitSlop', async () => {
    const { getByTestId } = await render(
      <IconButton
        onPress={jest.fn()}
        testID="test-empty-icon-btn"
        accessibilityLabel="Empty"
        hitSlop={10}
      />,
    );

    expect(getByTestId('test-empty-icon-btn')).toBeTruthy();
  });
});
