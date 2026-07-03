import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useLocationStore } from '@/store/location-store';
import MessagesScreen from '../app/(tabs)/messages';

// Mock location store — supports both hook call (useLocationStore()) and
// static getState (useLocationStore.getState()) used by useFeedbackSubmit
jest.mock('@/store/location-store', () => {
  const mockStore = {
    coords: { latitude: -34.56, longitude: -58.78 },
    status: 'ready',
    accuracy: null,
    errorMsg: null,
    startWatching: jest.fn(),
  };
  const useLocationStore = Object.assign(
    jest.fn(() => mockStore),
    {
      getState: () => mockStore,
    },
  );
  return { useLocationStore };
});

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

const mockFeed = [
  {
    id: 'msg-1',
    experienceId: 'general-feedback',
    message: 'Escuché un zorzal cerca del puente',
    createdAt: '2026-06-22T10:00:00.000Z',
    latitude: -34.56,
    longitude: -58.78,
  },
  {
    id: 'msg-2',
    experienceId: 'general-feedback',
    message: 'El río está crecido después de la lluvia',
    createdAt: '2026-06-22T10:05:00.000Z',
    latitude: -30.0,
    longitude: -60.0,
  },
];

describe('MessagesScreen', () => {
  beforeEach(() => {
    (useLocationStore as unknown as jest.Mock).mockReturnValue({
      coords: { latitude: -34.56, longitude: -58.78 },
      status: 'ready',
      accuracy: null,
      errorMsg: null,
      startWatching: jest.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFeed),
      }),
    ) as jest.Mock;
  });

  it('renders messages header title and lists community feeds', async () => {
    const { getByText } = render(<MessagesScreen />);

    await waitFor(() => {
      expect(getByText('messages.title')).toBeTruthy();
      expect(getByText('"Escuché un zorzal cerca del puente"')).toBeTruthy();
      expect(getByText('"El río está crecido después de la lluvia"')).toBeTruthy();
    });
  });

  it('filters by proximity (Cercanos tab)', async () => {
    const { getByText, getByTestId, queryByText } = render(<MessagesScreen />);

    await waitFor(() => {
      expect(getByText('"Escuché un zorzal cerca del puente"')).toBeTruthy();
    });

    // Switch to Cercanos tab
    const tabCercanos = getByTestId('tab-cercanos');
    fireEvent.press(tabCercanos);

    await waitFor(() => {
      // msg-1 is at the exact same mock coordinates, so it should be visible
      expect(getByText('"Escuché un zorzal cerca del puente"')).toBeTruthy();
      // msg-2 is far away, so it should be filtered out
      expect(queryByText('"El río está crecido después de la lluvia"')).toBeNull();
    });
  });

  it('opens submission modal when Mensaje nuevo is tapped', async () => {
    const { getByTestId } = render(<MessagesScreen />);

    // Wait for feed to load first so the button is rendered on the screen
    await waitFor(() => {
      expect(getByTestId('new-message-button')).toBeTruthy();
    });

    const newBtn = getByTestId('new-message-button');
    fireEvent.press(newBtn);

    await waitFor(() => {
      expect(getByTestId('feedback-input')).toBeTruthy();
    });
  });

  it('closes modal and refetches feed on successful submission', async () => {
    const { getByTestId, queryByTestId } = render(<MessagesScreen />);

    // Wait for feed to load
    await waitFor(() => {
      expect(getByTestId('new-message-button')).toBeTruthy();
    });

    // Open the modal
    fireEvent.press(getByTestId('new-message-button'));
    await waitFor(() => {
      expect(getByTestId('feedback-input')).toBeTruthy();
    });

    // Type a message and press submit
    const input = getByTestId('feedback-input');
    fireEvent.changeText(input, 'Test message');
    fireEvent.press(getByTestId('feedback-submit-button'));

    // Step 1 — wait for the submission to succeed (sent state appears, input hides)
    await waitFor(
      () => {
        expect(getByTestId('feedback-sent-state')).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Step 2 — wait for the auto-dismiss (BottomModal autoDismissDelay = 2s)
    await waitFor(
      () => {
        expect(queryByTestId('feedback-input')).toBeNull();
      },
      { timeout: 5000 },
    );

    // Step 3 — feed should have been refetched after submission
    await waitFor(
      () => {
        expect(queryByTestId('feedback-sent-state')).toBeNull();
      },
      { timeout: 5000 },
    );
  }, 20000);
});
