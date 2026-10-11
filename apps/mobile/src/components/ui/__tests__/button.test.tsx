import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders label and handles onPress', async () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = await render(
      <Button
        onPress={onPress}
        label="Click Me"
        testID="test-button"
        accessibilityLabel="Click Me"
      />,
    );

    expect(getByText('Click Me')).toBeTruthy();
    await fireEvent.press(getByTestId('test-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onPress when disabled', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <Button
        onPress={onPress}
        label="Disabled"
        disabled
        testID="test-button"
        accessibilityLabel="Disabled"
      />,
    );

    await fireEvent.press(getByTestId('test-button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders spinner and disables press when loading', async () => {
    const onPress = jest.fn();
    const { getByTestId, queryByText } = await render(
      <Button
        onPress={onPress}
        label="Loading"
        loading
        testID="test-button"
        accessibilityLabel="Loading"
      />,
    );

    expect(getByTestId('test-button-spinner')).toBeTruthy();
    expect(queryByText('Loading')).toBeNull();
    await fireEvent.press(getByTestId('test-button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders with secondary variant and iconName', async () => {
    const { getByText, getByTestId } = await render(
      <Button
        onPress={jest.fn()}
        label="Contact"
        variant="secondary"
        iconName="mail"
        testID="test-contact-button"
        accessibilityLabel="Contact"
      />,
    );

    expect(getByText('Contact')).toBeTruthy();
    expect(getByTestId('test-contact-button')).toBeTruthy();
  });
});
