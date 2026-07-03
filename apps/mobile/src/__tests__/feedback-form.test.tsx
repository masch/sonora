import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import FeedbackForm from '@/components/feedback-form';

// Mock BottomModal so useConfirm renders children when visible
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

const mockMap: Record<string, string> = {
  'feedback.form.title': 'Leave feedback',
  'feedback.form.placeholder': 'Tell us about your experience…',
  'feedback.form.submit': 'Send',
  'feedback.form.sending': 'Sending…',
  'feedback.form.sent': 'Sent!',
  'feedback.form.queued': 'Saved offline — will send when connected',
  'feedback.form.error': 'Something went wrong',
  'feedback.form.retry': 'Retry',
  'feedback.form.validation.empty': 'Message cannot be empty',
  'feedback.form.confirm.title': 'Discard feedback?',
  'feedback.form.confirm.body': 'You have unsaved changes',
  'feedback.form.confirm.discard': 'Discard',
  'feedback.form.confirm.cancel': 'Keep Editing',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

describe('FeedbackForm', () => {
  it('renders title, text input, and submit button', () => {
    const { getByText, getByTestId, getByPlaceholderText } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={jest.fn()} />,
    );

    expect(getByText('Leave feedback')).toBeTruthy();
    expect(getByTestId('feedback-input')).toBeTruthy();
    expect(getByTestId('feedback-submit-button')).toBeTruthy();
    expect(getByPlaceholderText('Tell us about your experience…')).toBeTruthy();
  });

  it('calls onSubmit with the typed message when submit is pressed', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <FeedbackForm visible={true} onSubmit={onSubmit} onDismiss={jest.fn()} />,
    );

    const input = getByTestId('feedback-input');
    fireEvent.changeText(input, 'Great trail!');

    fireEvent.press(getByTestId('feedback-submit-button'));

    expect(onSubmit).toHaveBeenCalledWith('Great trail!');
  });

  it('shows empty validation error when submitting empty message', () => {
    const onSubmit = jest.fn();
    const { getByText, getByTestId } = render(
      <FeedbackForm visible={true} onSubmit={onSubmit} onDismiss={jest.fn()} />,
    );

    fireEvent.press(getByTestId('feedback-submit-button'));

    expect(getByText('Message cannot be empty')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error for whitespace-only message', () => {
    const onSubmit = jest.fn();
    const { getByText, getByTestId } = render(
      <FeedbackForm visible={true} onSubmit={onSubmit} onDismiss={jest.fn()} />,
    );

    const input = getByTestId('feedback-input');
    fireEvent.changeText(input, '   ');

    fireEvent.press(getByTestId('feedback-submit-button'));

    expect(getByText('Message cannot be empty')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows sending state when status is sending', () => {
    const { getByText, queryByTestId } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={jest.fn()} status="sending" />,
    );

    expect(getByText('Sending…')).toBeTruthy();
    // Submit button should be disabled while sending
    expect(queryByTestId('feedback-submit-button')).toBeNull();
  });

  it('shows queued state when status is queued', () => {
    const { getByText } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={jest.fn()} status="queued" />,
    );

    expect(getByText('Saved offline — will send when connected')).toBeTruthy();
  });

  it('shows error state with retry button when status is error', () => {
    const { getByText, getByTestId } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={jest.fn()} status="error" />,
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByTestId('feedback-retry-button')).toBeTruthy();
  });

  it('calls onDismiss when dismiss is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId('feedback-dismiss-button'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has autoFocus enabled on TextInput', () => {
    const { getByTestId } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={jest.fn()} />,
    );
    const input = getByTestId('feedback-input');
    expect(input.props.autoFocus).toBe(true);
  });

  it('prompts confirmation dialog when dismissing with text', async () => {
    const onDismiss = jest.fn();

    const { getByTestId, findByText } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={onDismiss} />,
    );

    const input = getByTestId('feedback-input');
    fireEvent.changeText(input, 'Unsaved feedback text');

    fireEvent.press(getByTestId('feedback-dismiss-button'));

    // Confirm dialog should appear with title, blocking dismissal
    expect(await findByText('Discard feedback?')).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not prompt confirmation when status is sent or queued', () => {
    const onDismiss = jest.fn();

    const { getByTestId, queryByTestId, rerender } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={onDismiss} status={undefined} />,
    );

    const input = getByTestId('feedback-input');
    fireEvent.changeText(input, 'Feedback text');

    // Change status to sent
    rerender(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={onDismiss} status="sent" />,
    );

    // Verify input is unmounted/hidden
    expect(queryByTestId('feedback-input')).toBeNull();

    fireEvent.press(getByTestId('feedback-dismiss-button'));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('clears message and bypasses confirmation when status changes to queued', () => {
    const onDismiss = jest.fn();

    const { getByTestId, queryByTestId, rerender } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={onDismiss} status={undefined} />,
    );

    const input = getByTestId('feedback-input');
    fireEvent.changeText(input, 'Feedback text offline');

    // Change status to queued
    rerender(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={onDismiss} status="queued" />,
    );

    // Verify input is unmounted/hidden
    expect(queryByTestId('feedback-input')).toBeNull();

    fireEvent.press(getByTestId('feedback-dismiss-button'));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onSubmit when onSubmitEditing is triggered on TextInput', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <FeedbackForm visible={true} onSubmit={onSubmit} onDismiss={jest.fn()} />,
    );

    const input = getByTestId('feedback-input');
    fireEvent.changeText(input, 'Submitting via keyboard enter');
    fireEvent(input, 'submitEditing');

    expect(onSubmit).toHaveBeenCalledWith('Submitting via keyboard enter');
  });

  it('does not render when visible is false', () => {
    const { queryByTestId } = render(
      <FeedbackForm visible={false} onSubmit={jest.fn()} onDismiss={jest.fn()} />,
    );

    expect(queryByTestId('feedback-input')).toBeNull();
  });
});
