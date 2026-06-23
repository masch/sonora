import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useLocationStore } from '@/store/location-store';
import MessagesScreen from '../app/(tabs)/messages';

// Mock location store
jest.mock('@/store/location-store', () => ({
  useLocationStore: jest.fn(),
}));

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
});
