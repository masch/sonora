import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import FeedbackForm from '@/components/feedback-form';

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

  it('prompts confirmation Alert when dismissing with text', () => {
    const onDismiss = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(
      <FeedbackForm visible={true} onSubmit={jest.fn()} onDismiss={onDismiss} />,
    );

    const input = getByTestId('feedback-input');
    fireEvent.changeText(input, 'Unsaved feedback text');

    fireEvent.press(getByTestId('feedback-dismiss-button'));

    expect(alertSpy).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();

    // Clean up
    alertSpy.mockRestore();
  });

  it('does not render when visible is false', () => {
    const { queryByTestId } = render(
      <FeedbackForm visible={false} onSubmit={jest.fn()} onDismiss={jest.fn()} />,
    );

    expect(queryByTestId('feedback-input')).toBeNull();
  });
});
