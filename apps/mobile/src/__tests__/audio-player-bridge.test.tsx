import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';

import { AudioPlayerBridge } from '@/components/audio-player-bridge';
import { useAudioPlayerStore } from '@/store/audio-player-store';

// --- Mocks for expo-audio ---

const mockRemove = jest.fn();
const mockCreateAudioPlayer = jest.fn(() => ({
  remove: mockRemove,
}));
const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockRequestNotificationPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });

const defaultPlayerStatus = {
  playing: false,
  isLoaded: true,
  isBuffering: false,
  didJustFinish: false,
  currentTime: 0,
  duration: 0,
  error: null,
  timeControlStatus: 'ready' as const,
};

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: Parameters<typeof mockCreateAudioPlayer>) =>
    mockCreateAudioPlayer(...args),
  useAudioPlayerStatus: jest.fn(() => ({ ...defaultPlayerStatus })),
  setAudioModeAsync: (...args: Parameters<typeof mockSetAudioModeAsync>) =>
    mockSetAudioModeAsync(...args),
  requestNotificationPermissionsAsync: (
    ...args: Parameters<typeof mockRequestNotificationPermissionsAsync>
  ) => mockRequestNotificationPermissionsAsync(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn() },
}));

// --- Helpers ---

// Stash the original OS so we can restore it after each test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const platform: { OS: string } = Platform as any;
const originalOS = platform.OS;

beforeEach(() => {
  useAudioPlayerStore.setState({
    status: 'idle',
    positionMs: 0,
    durationMs: 0,
    errorMsg: null,
    currentUri: null,
    pendingPlayRequest: null,
    _player: null,
  });
  platform.OS = originalOS;
  jest.clearAllMocks();
});

describe('AudioPlayerBridge', () => {
  it('creates an AudioPlayer and registers it in the store on mount', async () => {
    await render(<AudioPlayerBridge />);

    expect(mockCreateAudioPlayer).toHaveBeenCalledWith(null);
    const state = useAudioPlayerStore.getState();
    expect(state._player).not.toBeNull();
  });

  it('removes the player and clears the store on unmount', async () => {
    const { unmount } = await render(<AudioPlayerBridge />);

    expect(useAudioPlayerStore.getState()._player).not.toBeNull();

    await unmount();

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(useAudioPlayerStore.getState()._player).toBeNull();
  });

  it('calls setAudioModeAsync with background playback config on mount', async () => {
    await render(<AudioPlayerBridge />);

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  });

  it('requests notification permissions on Android', async () => {
    platform.OS = 'android';

    await render(<AudioPlayerBridge />);

    expect(mockRequestNotificationPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('does NOT request notification permissions on iOS', async () => {
    platform.OS = 'ios';

    await render(<AudioPlayerBridge />);

    expect(mockRequestNotificationPermissionsAsync).not.toHaveBeenCalled();
  });

  it('syncs initial player status to the store', async () => {
    await render(<AudioPlayerBridge />);

    const state = useAudioPlayerStore.getState();
    // With isLoaded=true, playing=false, not buffering → idle
    expect(state.status).toBe('idle');
    expect(state.positionMs).toBe(0);
    expect(state.durationMs).toBe(0);
  });
});
