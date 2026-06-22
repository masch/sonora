import { Platform } from 'react-native';
import { create } from 'zustand';
import type { AudioPlayer, AudioMetadata, AudioLockScreenOptions } from 'expo-audio';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export interface PendingPlayRequest {
  uri: string;
  resume?: boolean;
}

export interface AudioPlayerState {
  status: PlayerStatus;
  positionMs: number;
  durationMs: number;
  errorMsg: string | null;
  currentUri: string | null;
  pendingPlayRequest: PendingPlayRequest | null;
  currentMetadata: AudioMetadata | null;
}

export interface AudioPlayerActions {
  play: (uri: string, resume?: boolean) => void;
  pause: () => void;
  stop: () => void;
  seekTo: (positionMs: number) => void;
  confirmInterrupt: () => void;
  cancelInterrupt: () => void;
  setNowPlayingMetadata: (metadata: AudioMetadata) => void;
  _setPlayer: (player: AudioPlayer | null) => void;
  _syncStatus: (partial: {
    status?: PlayerStatus;
    positionMs?: number;
    durationMs?: number;
    errorMsg?: string | null;
  }) => void;
}

export type AudioPlayerStore = AudioPlayerState & AudioPlayerActions;

const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showSeekBackward: true,
  showSeekForward: false,
};

function enableLockScreenControls(player: AudioPlayer, metadata: AudioMetadata | null) {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    try {
      player.setActiveForLockScreen(true, metadata ?? undefined, LOCK_SCREEN_OPTIONS);
    } catch {
      // Gracefully handle — lock screen controls are best-effort
    }
  }
}

function disableLockScreenControls(player: AudioPlayer) {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    try {
      player.setActiveForLockScreen(false);
    } catch {
      // Best-effort cleanup
    }
  }
}

export const useAudioPlayerStore = create<AudioPlayerStore & { _player: AudioPlayer | null }>(
  (set, get) => ({
    status: 'idle',
    positionMs: 0,
    durationMs: 0,
    errorMsg: null,
    currentUri: null,
    pendingPlayRequest: null,
    currentMetadata: null,
    _player: null,

    play: (uri: string, resume?: boolean) => {
      const { status, currentUri, _player, currentMetadata } = get();

      // If playing a different source, set up interrupt
      if (status === 'playing' && currentUri && currentUri !== uri) {
        set({ pendingPlayRequest: { uri, resume } });
        return;
      }

      if (_player) {
        // Replace source if URI changed
        if (currentUri !== uri) {
          _player.replace(uri);
        }
        _player.play();
        enableLockScreenControls(_player, currentMetadata);
        set({ currentUri: uri, status: 'playing', errorMsg: null });
      }
    },

    pause: () => {
      const { _player } = get();
      _player?.pause();
      if (_player) disableLockScreenControls(_player);
      set({ status: 'paused' });
    },

    stop: () => {
      const { _player } = get();
      _player?.pause();
      _player?.seekTo(0);
      if (_player) disableLockScreenControls(_player);
      set({ status: 'stopped', positionMs: 0 });
    },

    seekTo: (positionMs: number) => {
      const { _player } = get();
      _player?.seekTo(positionMs / 1000);
      set({ positionMs });
    },

    confirmInterrupt: () => {
      const { pendingPlayRequest, _player, currentMetadata } = get();
      if (!pendingPlayRequest) return;

      const { uri } = pendingPlayRequest;
      if (_player) {
        _player.pause();
        _player.seekTo(0);
        _player.replace(uri);
        _player.play();
        enableLockScreenControls(_player, currentMetadata);
      }
      set({
        currentUri: uri,
        status: 'playing',
        pendingPlayRequest: null,
        positionMs: 0,
      });
    },

    cancelInterrupt: () => {
      set({ pendingPlayRequest: null });
    },

    setNowPlayingMetadata: (metadata: AudioMetadata) => {
      const { _player, status } = get();
      set({ currentMetadata: metadata });
      if (_player && status === 'playing') {
        enableLockScreenControls(_player, metadata);
      }
    },

    _setPlayer: (player: AudioPlayer | null) => {
      set({ _player: player });
    },

    _syncStatus: (partial) => {
      set(partial);
    },
  }),
);
