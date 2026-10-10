import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import { LeadCaptureButton } from '@/components/lead-capture-button';
import { LeadClient } from '@/services/lead-client';

// Mock BottomModal — RN <Modal> crashes in test renderer (React 19)
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
  'leadCapture.button': 'Contact',
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

describe('LeadCaptureButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders button and toggles modal visibility on press', async () => {
    const { getByTestId, queryByTestId } = await render(
      <LeadCaptureButton
        source="track_detail"
        experienceId="123e4567-e89b-12d3-a456-426614174000"
      />,
    );

    const button = getByTestId('lead-capture-open-button');
    expect(button).toBeTruthy();
    expect(queryByTestId('lead-capture-email-input')).toBeNull();

    await fireEvent.press(button);

    expect(queryByTestId('lead-capture-email-input')).toBeTruthy();

    await fireEvent.press(getByTestId('lead-capture-dismiss-button'));

    expect(queryByTestId('lead-capture-email-input')).toBeNull();
  });

  it('validates empty email before submitting', async () => {
    const { getByTestId, getByText } = await render(<LeadCaptureButton source="track_detail" />);

    await fireEvent.press(getByTestId('lead-capture-open-button'));
    await fireEvent.press(getByTestId('lead-capture-submit-button'));

    expect(getByText('Email cannot be empty')).toBeTruthy();
    expect(LeadClient.submitLead).not.toHaveBeenCalled();
  });

  it('validates invalid email format before submitting', async () => {
    const { getByTestId, getByText } = await render(<LeadCaptureButton source="track_detail" />);

    await fireEvent.press(getByTestId('lead-capture-open-button'));
    await fireEvent.changeText(getByTestId('lead-capture-email-input'), 'invalid-email');
    await fireEvent.press(getByTestId('lead-capture-submit-button'));

    expect(getByText('Please enter a valid email address')).toBeTruthy();
    expect(LeadClient.submitLead).not.toHaveBeenCalled();
  });

  it('submits valid email via LeadClient and transitions to success state', async () => {
    (LeadClient.submitLead as jest.Mock).mockResolvedValueOnce({ status: 'ok' });
    const onSubmitSuccess = jest.fn();

    const { getByTestId, getByText, queryByTestId } = await render(
      <LeadCaptureButton
        source="track_detail"
        experienceId="123e4567-e89b-12d3-a456-426614174000"
        onSubmitSuccess={onSubmitSuccess}
      />,
    );

    await fireEvent.press(getByTestId('lead-capture-open-button'));
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

    const { getByTestId, getByText } = await render(<LeadCaptureButton source="trip_detail" />);

    await fireEvent.press(getByTestId('lead-capture-open-button'));
    await fireEvent.changeText(getByTestId('lead-capture-email-input'), 'user@example.com');
    await fireEvent.press(getByTestId('lead-capture-submit-button'));

    await waitFor(() => {
      expect(getByTestId('lead-capture-error-state')).toBeTruthy();
      expect(getByText('Something went wrong. Please try again.')).toBeTruthy();
    });
  });
});
