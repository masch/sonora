import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

// Mock Tw* components as native RN primitives
jest.mock('@/tw', () => {
  const React = jest.requireActual('react');
  const { Pressable, TextInput, View } = jest.requireActual('react-native');
  return {
    TwView: ({ children }: Record<string, unknown>) => React.createElement(View, null, children),
    TwPressable: (props: Record<string, unknown>) =>
      React.createElement(
        Pressable,
        {
          ...props,
        },
        props.children,
      ),
    TwTextInput: (props: Record<string, unknown>) =>
      React.createElement(
        TextInput,
        {
          ...props,
        },
        props.children,
      ),
  };
});

// Mock BottomModal as simple View that renders content when visible
jest.mock('@/components/ui/bottom-modal', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    BottomModal: ({
      visible,
      onDismiss,
      children,
    }: {
      visible: boolean;
      onDismiss?: () => void;
      children: React.ReactNode;
    }) => {
      if (!visible) return null;
      return React.createElement(View, { testID: 'restore-modal', onDismiss }, children);
    },
  };
});

jest.mock('@/components/themed-text', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    ThemedText: ({ children }: Record<string, unknown>) =>
      React.createElement(Text, null, children),
  };
});

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    textSecondary: '#666666',
    text: '#000000',
    background: '#ffffff',
  }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { PaymentPrompt } from '@/components/payment-prompt';

describe('PaymentPrompt', () => {
  const defaultProps = {
    price: 15000,
    currency: 'ARS',
    onPay: jest.fn(),
    onRestore: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the price formatted in ARS', async () => {
    const { getByText } = await render(<PaymentPrompt {...defaultProps} />);
    expect(getByText(/150/)).toBeTruthy();
  });

  it('renders pay button', async () => {
    const { getByTestId } = await render(<PaymentPrompt {...defaultProps} />);
    expect(getByTestId('pay-button')).toBeTruthy();
  });

  it('calls onPay when pay button is pressed', async () => {
    const { getByTestId } = await render(<PaymentPrompt {...defaultProps} />);
    await fireEvent.press(getByTestId('pay-button'));
    expect(defaultProps.onPay).toHaveBeenCalledTimes(1);
  });

  it('shows error text when error prop is provided', async () => {
    const { getByText } = await render(
      <PaymentPrompt {...defaultProps} error="Something went wrong" />,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('shows restore link button', async () => {
    const { getByTestId } = await render(<PaymentPrompt {...defaultProps} />);
    expect(getByTestId('restore-link-button')).toBeTruthy();
  });

  it('opens restore modal when restore link is pressed', async () => {
    const { getByTestId } = await render(<PaymentPrompt {...defaultProps} />);
    await fireEvent.press(getByTestId('restore-link-button'));
    expect(getByTestId('restore-modal')).toBeTruthy();
  });

  it('shows restore email input and restore button in modal', async () => {
    const { getByTestId } = await render(<PaymentPrompt {...defaultProps} />);
    await fireEvent.press(getByTestId('restore-link-button'));

    expect(getByTestId('restore-email-input')).toBeTruthy();
    expect(getByTestId('restore-button')).toBeTruthy();
    expect(getByTestId('restore-cancel-button')).toBeTruthy();
  });

  it('calls onRestore with email when restore button is pressed', async () => {
    defaultProps.onRestore.mockResolvedValue(true);

    const { getByTestId } = await render(<PaymentPrompt {...defaultProps} />);
    await fireEvent.press(getByTestId('restore-link-button'));

    const input = getByTestId('restore-email-input');
    await fireEvent.changeText(input, 'user@example.com');
    await fireEvent.press(getByTestId('restore-button'));

    await waitFor(() => {
      expect(defaultProps.onRestore).toHaveBeenCalledWith('user@example.com');
    });
  });

  it('shows invalidEmail error when email format is invalid and does not call onRestore', async () => {
    defaultProps.onRestore.mockClear();

    const { getByTestId, getByText, queryByText } = await render(
      <PaymentPrompt {...defaultProps} />,
    );
    await fireEvent.press(getByTestId('restore-link-button'));

    const input = getByTestId('restore-email-input');
    await fireEvent.changeText(input, 'not-an-email');
    await fireEvent.press(getByTestId('restore-button'));

    await waitFor(() => {
      expect(getByText('payments.restore.invalidEmail')).toBeTruthy();
      expect(defaultProps.onRestore).not.toHaveBeenCalled();
    });

    // Auto-clears error when user types again
    await fireEvent.changeText(input, 'not-an-email@');
    expect(queryByText('payments.restore.invalidEmail')).toBeNull();
  });

  it('shows invalidEmail error when submitting with empty email', async () => {
    const { getByTestId, getByText } = await render(<PaymentPrompt {...defaultProps} />);
    await fireEvent.press(getByTestId('restore-link-button'));

    await fireEvent.press(getByTestId('restore-button'));

    await waitFor(() => {
      expect(getByText('payments.restore.invalidEmail')).toBeTruthy();
      expect(defaultProps.onRestore).not.toHaveBeenCalled();
    });
  });

  it('shows notFound error when restore returns false', async () => {
    defaultProps.onRestore.mockResolvedValue(false);

    const { getByTestId, getByText } = await render(<PaymentPrompt {...defaultProps} />);
    await fireEvent.press(getByTestId('restore-link-button'));

    const input = getByTestId('restore-email-input');
    await fireEvent.changeText(input, 'nobody@example.com');
    await fireEvent.press(getByTestId('restore-button'));

    await waitFor(() => {
      expect(getByText('payments.restore.notFound')).toBeTruthy();
    });
  });

  it('shows restore error when onRestore throws', async () => {
    defaultProps.onRestore.mockRejectedValue(new Error('Network error'));

    const { getByTestId, getByText } = await render(<PaymentPrompt {...defaultProps} />);
    await fireEvent.press(getByTestId('restore-link-button'));

    const input = getByTestId('restore-email-input');
    await fireEvent.changeText(input, 'error@example.com');
    await fireEvent.press(getByTestId('restore-button'));

    await waitFor(() => {
      expect(getByText('payments.error.restore')).toBeTruthy();
    });
  });

  it('closes modal on cancel', async () => {
    const { getByTestId, queryByTestId } = await render(<PaymentPrompt {...defaultProps} />);
    await fireEvent.press(getByTestId('restore-link-button'));

    expect(getByTestId('restore-modal')).toBeTruthy();

    await fireEvent.press(getByTestId('restore-cancel-button'));

    expect(queryByTestId('restore-modal')).toBeNull();
  });

  it('closes modal and clears error on onDismiss callback', async () => {
    const { getByTestId, queryByTestId, queryByText } = await render(
      <PaymentPrompt {...defaultProps} />,
    );
    await fireEvent.press(getByTestId('restore-link-button'));

    expect(getByTestId('restore-modal')).toBeTruthy();

    // Trigger an invalid email error
    await fireEvent.changeText(getByTestId('restore-email-input'), 'invalid-email');
    await fireEvent.press(getByTestId('restore-button'));
    expect(queryByText('payments.restore.invalidEmail')).toBeTruthy();

    // Dismiss via onDismiss callback
    await fireEvent(getByTestId('restore-modal'), 'dismiss');
    expect(queryByTestId('restore-modal')).toBeNull();

    // Reopen modal and confirm error is cleared
    await fireEvent.press(getByTestId('restore-link-button'));
    expect(getByTestId('restore-modal')).toBeTruthy();
    expect(queryByText('payments.restore.invalidEmail')).toBeNull();
  });
});
