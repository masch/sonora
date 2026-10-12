import { Keyboard, Platform } from 'react-native';
import { BottomModal } from '@/components/ui/bottom-modal';
import { TwText } from '@/tw';
import { act, fireEvent, render } from '@testing-library/react-native';

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
    await fireEvent.press(backdrop);

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
    await fireEvent.press(contentContainer);

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

  it('renders with correct KeyboardAvoidingView and card padding', async () => {
    const { getByTestId } = await render(
      <BottomModal visible={true} onDismiss={jest.fn()}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    expect(getByTestId('bottom-modal-keyboard-view')).toBeTruthy();
    expect(getByTestId('bottom-modal-card')).toBeTruthy();
    expect(getByTestId('bottom-modal-card').props.style).toEqual(
      expect.objectContaining({ paddingBottom: 24 }),
    );
  });

  it('applies ModalWebPadding on web platform', async () => {
    const selectSpy = jest
      .spyOn(Platform, 'select')
      .mockImplementation((specifics: { web?: unknown }) => specifics.web);
    try {
      const { getByTestId } = await render(
        <BottomModal visible={true} onDismiss={jest.fn()}>
          <TwText>Modal Content</TwText>
        </BottomModal>,
      );

      expect(getByTestId('bottom-modal-card').props.style).toEqual(
        expect.objectContaining({ paddingBottom: 16 }),
      );
    } finally {
      selectSpy.mockRestore();
    }
  });

  it('registers keyboard listeners and updates padding when keyboard shows and hides', async () => {
    let showCallback: ((event: { endCoordinates: { height: number } }) => void) | undefined;
    let hideCallback: (() => void) | undefined;

    const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      callback: unknown,
    ) => {
      if (event === 'keyboardWillShow' || event === 'keyboardDidShow') {
        showCallback = callback as (event: { endCoordinates: { height: number } }) => void;
      }
      if (event === 'keyboardWillHide' || event === 'keyboardDidHide') {
        hideCallback = callback as () => void;
      }
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);

    const { getByTestId, unmount } = await render(
      <BottomModal visible={true} onDismiss={jest.fn()}>
        <TwText>Modal Content</TwText>
      </BottomModal>,
    );

    expect(showCallback).toBeDefined();
    expect(hideCallback).toBeDefined();

    await act(async () => {
      showCallback?.({ endCoordinates: { height: 280 } });
    });

    expect(getByTestId('bottom-modal-card').props.style).toEqual(
      expect.objectContaining({ paddingBottom: 24 }),
    );

    await act(async () => {
      hideCallback?.();
    });

    expect(getByTestId('bottom-modal-card').props.style).toEqual(
      expect.objectContaining({ paddingBottom: 24 }),
    );

    unmount();
    addListenerSpy.mockRestore();
  });

  it('renders title and dismiss button when title is provided', async () => {
    const onDismiss = jest.fn();
    const { getByText, getByTestId } = await render(
      <BottomModal visible={true} onDismiss={onDismiss} title="Test Modal Title">
        <TwText>Modal Body</TwText>
      </BottomModal>,
    );

    expect(getByText('Test Modal Title')).toBeTruthy();
    const closeBtn = getByTestId('bottom-modal-dismiss-button');
    expect(closeBtn).toBeTruthy();

    await fireEvent.press(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders custom footer slot when provided', async () => {
    const { getByText } = await render(
      <BottomModal visible={true} onDismiss={jest.fn()} footer={<TwText>Action Footer</TwText>}>
        <TwText>Modal Body</TwText>
      </BottomModal>,
    );

    expect(getByText('Modal Body')).toBeTruthy();
    expect(getByText('Action Footer')).toBeTruthy();
  });
});
