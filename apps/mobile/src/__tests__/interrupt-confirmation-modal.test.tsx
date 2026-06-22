import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { InterruptConfirmationModal } from '@/components/interrupt-confirmation-modal';

const mockConfirmInterrupt = jest.fn();
const mockCancelInterrupt = jest.fn();

let mockPendingPlayRequest: { uri: string; resume?: boolean } | null = null;

jest.mock('@/store/audio-player-store', () => ({
  useAudioPlayerStore: (selector: (state: unknown) => unknown) => {
    const state = {
      pendingPlayRequest: mockPendingPlayRequest,
      confirmInterrupt: mockConfirmInterrupt,
      cancelInterrupt: mockCancelInterrupt,
    };
    return selector(state);
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'audio.interruptModalTitle': 'Cancel current audio?',
        'audio.interruptModalMessage': 'Playing new audio will stop the current one.',
        'common.yes': 'Yes',
        'common.no': 'No',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

describe('InterruptConfirmationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingPlayRequest = null;
  });

  it('renders when pendingPlayRequest is set', () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByTestId } = render(<InterruptConfirmationModal />);
    expect(getByTestId('interrupt-confirmation-modal')).toBeTruthy();
  });

  it('does not render when no pending request', () => {
    const { queryByTestId } = render(<InterruptConfirmationModal />);
    expect(queryByTestId('interrupt-confirmation-modal')).toBeNull();
  });

  it('calls confirmInterrupt on Yes button press', () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByTestId } = render(<InterruptConfirmationModal />);
    fireEvent.press(getByTestId('interrupt-confirm-button'));

    expect(mockConfirmInterrupt).toHaveBeenCalledTimes(1);
  });

  it('calls cancelInterrupt on No button press', () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByTestId } = render(<InterruptConfirmationModal />);
    fireEvent.press(getByTestId('interrupt-deny-button'));

    expect(mockCancelInterrupt).toHaveBeenCalledTimes(1);
  });

  it('calls cancelInterrupt when backdrop is pressed', () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByTestId } = render(<InterruptConfirmationModal />);
    const backdrop = getByTestId('bottom-modal-backdrop');
    fireEvent.press(backdrop);

    expect(mockCancelInterrupt).toHaveBeenCalledTimes(1);
  });

  it('shows title and message text', () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByText } = render(<InterruptConfirmationModal />);
    expect(getByText('Cancel current audio?')).toBeTruthy();
    expect(getByText('Playing new audio will stop the current one.')).toBeTruthy();
  });
});
