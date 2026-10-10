import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import { LeadCaptureModal } from '@/components/lead-capture-modal';
import { LeadClient } from '@/services/lead-client';

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

jest.mock('@/services/lead-client', () => ({
  LeadClient: {
    submitLead: jest.fn(),
  },
}));

const mockMap: Record<string, string> = {
  'leadCapture.title': 'Leave your contact',
  'leadCapture.description': 'Enter your email to receive updates and more information.',
  'leadCapture.emailPlaceholder': 'you@email.com',
  'leadCapture.submit': 'Send',
  'leadCapture.submitting': 'Sending…',
  'leadCapture.successTitle': 'Thank you!',
  'leadCapture.successMessage': 'We successfully saved your contact.',
  'leadCapture.error': 'Something went wrong. Please try again.',
  'leadCapture.validation.empty': 'Email cannot be empty',
  'leadCapture.validation.invalid': 'Please enter a valid email address',
  'leadCapture.close': 'Close',
  'common.dismiss': 'Dismiss',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

describe('LeadCaptureModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title, description, input, and submit button when visible', async () => {
    const { getByText, getByTestId, getByPlaceholderText } = await render(
      <LeadCaptureModal
        visible={true}
        onDismiss={jest.fn()}
        source="track_detail"
        experienceId="123e4567-e89b-12d3-a456-426614174000"
      />,
    );

    expect(getByText('Leave your contact')).toBeTruthy();
    expect(getByText('Enter your email to receive updates and more information.')).toBeTruthy();
    expect(getByPlaceholderText('you@email.com')).toBeTruthy();
    expect(getByTestId('lead-capture-email-input')).toBeTruthy();
    expect(getByTestId('lead-capture-submit-button')).toBeTruthy();
  });

  it('validates empty email before submitting', async () => {
    const { getByTestId, getByText } = await render(
      <LeadCaptureModal visible={true} onDismiss={jest.fn()} source="track_detail" />,
    );

    await fireEvent.press(getByTestId('lead-capture-submit-button'));

    expect(getByText('Email cannot be empty')).toBeTruthy();
    expect(LeadClient.submitLead).not.toHaveBeenCalled();
  });

  it('validates invalid email format before submitting', async () => {
    const { getByTestId, getByText } = await render(
      <LeadCaptureModal visible={true} onDismiss={jest.fn()} source="track_detail" />,
    );

    await fireEvent.changeText(getByTestId('lead-capture-email-input'), 'invalid-email');
    await fireEvent.press(getByTestId('lead-capture-submit-button'));

    expect(getByText('Please enter a valid email address')).toBeTruthy();
    expect(LeadClient.submitLead).not.toHaveBeenCalled();
  });

  it('submits valid email via LeadClient and transitions to success state', async () => {
    (LeadClient.submitLead as jest.Mock).mockResolvedValueOnce({ status: 'ok' });
    const onSubmitSuccess = jest.fn();

    const { getByTestId, getByText, queryByTestId } = await render(
      <LeadCaptureModal
        visible={true}
        onDismiss={jest.fn()}
        source="track_detail"
        experienceId="123e4567-e89b-12d3-a456-426614174000"
        onSubmitSuccess={onSubmitSuccess}
      />,
    );

    await fireEvent.changeText(getByTestId('lead-capture-email-input'), 'user@example.com');
    await fireEvent.press(getByTestId('lead-capture-submit-button'));

    await waitFor(() => {
      expect(LeadClient.submitLead).toHaveBeenCalledWith({
        email: 'user@example.com',
        source: 'track_detail',
        experienceId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(getByTestId('lead-capture-success-state')).toBeTruthy();
      expect(getByText('Thank you!')).toBeTruthy();
      expect(getByText('We successfully saved your contact.')).toBeTruthy();
      expect(queryByTestId('lead-capture-email-input')).toBeNull();
      expect(onSubmitSuccess).toHaveBeenCalled();
    });
  });

  it('shows error state when LeadClient fails', async () => {
    (LeadClient.submitLead as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { getByTestId, getByText } = await render(
      <LeadCaptureModal visible={true} onDismiss={jest.fn()} source="trip_detail" />,
    );

    await fireEvent.changeText(getByTestId('lead-capture-email-input'), 'user@example.com');
    await fireEvent.press(getByTestId('lead-capture-submit-button'));

    await waitFor(() => {
      expect(getByTestId('lead-capture-error-state')).toBeTruthy();
      expect(getByText('Something went wrong. Please try again.')).toBeTruthy();
    });
  });

  it('calls onDismiss when close button is pressed', async () => {
    const onDismiss = jest.fn();
    const { getByTestId } = await render(
      <LeadCaptureModal visible={true} onDismiss={onDismiss} source="track_detail" />,
    );

    await fireEvent.press(getByTestId('lead-capture-dismiss-button'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
