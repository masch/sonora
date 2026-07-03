import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useConfirm } from '../use-confirm';

// Mock BottomModal so children render when visible
jest.mock('@/components/ui/bottom-modal', () => {
  const MockBottomModal = ({
    visible,
    children,
  }: {
    children: React.ReactNode;
    visible: boolean;
  }) => (visible ? <>{children}</> : null);
  return { __esModule: true, default: MockBottomModal, BottomModal: MockBottomModal };
});

/** Wrapper that exposes confirm() and renders the modal component. */
function TestHarness({
  onResult,
  destructive,
}: {
  onResult?: (ok: boolean) => void;
  destructive?: boolean;
}) {
  const { confirm, component } = useConfirm();
  const [result, setResult] = useState<boolean | null>(null);

  const handleTrigger = async () => {
    const ok = await confirm({
      title: 'Test Title',
      message: 'Test Message',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      destructive,
    });
    setResult(ok);
    onResult?.(ok);
  };

  return (
    <>
      <Pressable testID="trigger" onPress={handleTrigger}>
        <Text>Trigger</Text>
      </Pressable>
      {component}
      {result !== null && <Text testID="result">{result ? 'confirmed' : 'cancelled'}</Text>}
    </>
  );
}

describe('useConfirm', () => {
  it('shows confirm dialog when trigger is pressed', async () => {
    const { getByTestId, findByText } = await render(<TestHarness />);

    await fireEvent.press(getByTestId('trigger'));

    expect(await findByText('Test Title')).toBeTruthy();
    expect(await findByText('Test Message')).toBeTruthy();
  });

  it('resolves to true when confirm is pressed', async () => {
    const onResult = jest.fn();
    const { getByTestId, findByTestId } = await render(<TestHarness onResult={onResult} />);

    await fireEvent.press(getByTestId('trigger'));
    await fireEvent.press(await findByTestId('confirm-button'));

    await waitFor(() => {
      expect(getByTestId('result')).toHaveTextContent('confirmed');
    });
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('resolves to false when cancel is pressed', async () => {
    const onResult = jest.fn();
    const { getByTestId, findByTestId } = await render(<TestHarness onResult={onResult} />);

    await fireEvent.press(getByTestId('trigger'));
    await fireEvent.press(await findByTestId('confirm-cancel-button'));

    await waitFor(() => {
      expect(getByTestId('result')).toHaveTextContent('cancelled');
    });
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('applies destructive testID when destructive is true', async () => {
    const { getByTestId, findByTestId } = await render(
      <TestHarness destructive onResult={jest.fn()} />,
    );

    await fireEvent.press(getByTestId('trigger'));
    expect(await findByTestId('confirm-destructive-button')).toBeTruthy();
  });

  it('shows both cancel and confirm buttons', async () => {
    const { getByTestId, findByTestId } = await render(<TestHarness />);

    await fireEvent.press(getByTestId('trigger'));

    expect(await findByTestId('confirm-cancel-button')).toBeTruthy();
    expect(await findByTestId('confirm-button')).toBeTruthy();
  });
});
