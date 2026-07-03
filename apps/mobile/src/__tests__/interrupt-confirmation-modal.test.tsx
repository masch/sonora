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

  it('renders when pendingPlayRequest is set', async () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByTestId } = await render(<InterruptConfirmationModal />);
    expect(getByTestId('interrupt-confirmation-modal')).toBeTruthy();
  });

  it('does not render when no pending request', async () => {
    const { queryByTestId } = await render(<InterruptConfirmationModal />);
    expect(queryByTestId('interrupt-confirmation-modal')).toBeNull();
  });

  it('calls confirmInterrupt on Yes button press', async () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByTestId } = await render(<InterruptConfirmationModal />);
    await fireEvent.press(getByTestId('interrupt-confirm-button'));

    expect(mockConfirmInterrupt).toHaveBeenCalledTimes(1);
  });

  it('calls cancelInterrupt on No button press', async () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByTestId } = await render(<InterruptConfirmationModal />);
    await fireEvent.press(getByTestId('interrupt-deny-button'));

    expect(mockCancelInterrupt).toHaveBeenCalledTimes(1);
  });

  it('calls cancelInterrupt when backdrop is pressed', async () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByTestId } = await render(<InterruptConfirmationModal />);
    const backdrop = getByTestId('bottom-modal-backdrop');
    await fireEvent.press(backdrop);

    expect(mockCancelInterrupt).toHaveBeenCalledTimes(1);
  });

  it('shows title and message text', async () => {
    mockPendingPlayRequest = { uri: 'new-uri' };

    const { getByText } = await render(<InterruptConfirmationModal />);
    expect(getByText('Cancel current audio?')).toBeTruthy();
    expect(getByText('Playing new audio will stop the current one.')).toBeTruthy();
  });
});
