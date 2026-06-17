import React from 'react';
import {
  Modal as RNModal,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
} from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { TwText } from '@/tw';
import { BottomModal } from '@/components/ui/bottom-modal';

describe('BottomModal', () => {
  it('renders children when visible is true', () => {
    const { getByText } = render(
      <BottomModal visible={true} onDismiss={jest.fn()}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    expect(getByText('Modal Content')).toBeTruthy();
  });

  it('does not render children when visible is false', () => {
    const { queryByText } = render(
      <BottomModal visible={false} onDismiss={jest.fn()}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    expect(queryByText('Modal Content')).toBeNull();
  });

  it('calls onDismiss when backdrop is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <BottomModal visible={true} onDismiss={onDismiss}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    const backdrop = getByTestId('bottom-modal-backdrop');
    fireEvent.press(backdrop);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call onDismiss when modal content is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <BottomModal visible={true} onDismiss={onDismiss}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    const contentContainer = getByTestId('bottom-modal-content-container');
    fireEvent.press(contentContainer);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss automatically when autoDismissTrigger is true', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(
      <BottomModal visible={true} onDismiss={onDismiss} autoDismissTrigger={true}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    expect(onDismiss).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('renders Modal with statusBarTranslucent and correct KeyboardAvoidingView behavior', () => {
    const { UNSAFE_getByType } = render(
      <BottomModal visible={true} onDismiss={jest.fn()}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    const modalInstance = UNSAFE_getByType(RNModal);
    const keyboardAvoidingViewInstance = UNSAFE_getByType(RNKeyboardAvoidingView);

    expect(modalInstance.props.statusBarTranslucent).toBe(true);
    expect(keyboardAvoidingViewInstance.props.behavior).toBe(
      Platform.OS === 'ios' ? 'padding' : 'height',
    );
  });
});
