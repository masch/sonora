import { BottomModal } from '@/components/ui/bottom-modal';
import { TwText } from '@/tw';
import { fireEvent, render } from '@testing-library/react-native';
import { KeyboardAvoidingView as RNKeyboardAvoidingView, Modal as RNModal } from 'react-native';

describe('BottomModal', () => {
  it('renders children when visible is true', async () => {
    const { getByText } = await render(
      <BottomModal visible={true} onDismiss={jest.fn()}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    expect(getByText('Modal Content')).toBeTruthy();
  });

  it('does not render children when visible is false', async () => {
    const { queryByText } = await render(
      <BottomModal visible={false} onDismiss={jest.fn()}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    expect(queryByText('Modal Content')).toBeNull();
  });

  it('calls onDismiss when backdrop is pressed', async () => {
    const onDismiss = jest.fn();
    const { getByTestId } = await render(
      <BottomModal visible={true} onDismiss={onDismiss}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    const backdrop = getByTestId('bottom-modal-backdrop');
    fireEvent.press(backdrop);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call onDismiss when modal content is pressed', async () => {
    const onDismiss = jest.fn();
    const { getByTestId } = await render(
      <BottomModal visible={true} onDismiss={onDismiss}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    const contentContainer = getByTestId('bottom-modal-content-container');
    fireEvent.press(contentContainer);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss automatically when autoDismissTrigger is true', async () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    await render(
      <BottomModal visible={true} onDismiss={onDismiss} autoDismissTrigger={true}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    expect(onDismiss).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('renders Modal with statusBarTranslucent and correct KeyboardAvoidingView behavior', async () => {
    const { UNSAFE_getByType } = await render(
      <BottomModal visible={true} onDismiss={jest.fn()}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    const modalInstance = UNSAFE_getByType(RNModal);
    const keyboardAvoidingViewInstance = UNSAFE_getByType(RNKeyboardAvoidingView);

    expect(modalInstance.props.statusBarTranslucent).toBe(true);
    expect(keyboardAvoidingViewInstance.props.behavior).toBe('padding');
  });
});
