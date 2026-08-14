import { type AudioLockScreenOptions, type AudioMetadata, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { AnalyticsService } from '@/services/analytics';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export type ExperienceAudioMetadata = AudioMetadata & {
  id?: string;
  slug?: string;
};

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
  currentMetadata: ExperienceAudioMetadata | null;
}

export interface AudioPlayerActions {
  play: (uri: string, resume?: boolean) => void;
  pause: () => void;
  stop: () => void;
  seekTo: (positionMs: number) => void;
  rewind: (offsetMs: number) => void;
  confirmInterrupt: () => void;
  cancelInterrupt: () => void;
  setNowPlayingMetadata: (metadata: ExperienceAudioMetadata) => void;
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

let lastLockScreenMetadataStr = '';
let isLockScreenActive = false;
let lockScreenUpdateTimer: ReturnType<typeof setTimeout> | null = null;

export function enableLockScreenControlsSafe(
  player: AudioPlayer,
  metadata: ExperienceAudioMetadata | null,
) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  const serialized = JSON.stringify(metadata ?? {});
  if (serialized === lastLockScreenMetadataStr && isLockScreenActive) {
    return;
  }

  if (lockScreenUpdateTimer) {
    clearTimeout(lockScreenUpdateTimer);
  }

  lockScreenUpdateTimer = setTimeout(() => {
    lockScreenUpdateTimer = null;
    try {
      player.setActiveForLockScreen(true, metadata ?? undefined, LOCK_SCREEN_OPTIONS);
      lastLockScreenMetadataStr = serialized;
      isLockScreenActive = true;
    } catch {
      // Gracefully handle — lock screen controls are best-effort
    }
  }, 100);
}

function enableLockScreenControls(player: AudioPlayer, metadata: ExperienceAudioMetadata | null) {
  enableLockScreenControlsSafe(player, metadata);
}

function disableLockScreenControls(player: AudioPlayer) {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    if (lockScreenUpdateTimer) {
      clearTimeout(lockScreenUpdateTimer);
      lockScreenUpdateTimer = null;
    }
    lastLockScreenMetadataStr = '';
    isLockScreenActive = false;
    try {
      player.setActiveForLockScreen(false);
    } catch {
      // Best-effort cleanup
    }
  }
}

export function getTrackIdFromUri(uri: string | null): string {
  if (!uri) return 'unknown';

  // For local cached files, the track ID is the parent directory name: /tracks/{trackId}/audio.mp3
  if (uri.includes('/tracks/')) {
    const parts = uri.split('/tracks/');
    const afterTracks = parts[1];
    if (afterTracks) {
      const trackId = afterTracks.split('/')[0];
      if (trackId) return trackId;
    }
  }

  const parts = uri.split('/');
  const lastPart = parts[parts.length - 1] || 'unknown';
  return lastPart.replace(/\.[^/.]+$/, ''); // strip extension
}

export function cleanExperienceId(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.replace(/^(track|trip)-/, '');
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

        AnalyticsService.trackEvent('audio_playback_started', {
          track_id: getTrackIdFromUri(uri),
          uri,
          title: currentMetadata?.title ?? 'unknown',
          resume: !!resume,
        });
      }
    },

    pause: () => {
      const { _player, currentUri, positionMs, currentMetadata } = get();
      _player?.pause();
      // Keep lock screen controls active so the player shows in paused state
      // when the phone is locked — Android shows a Play button to resume.
      set({ status: 'paused' });

      AnalyticsService.trackEvent('audio_playback_paused', {
        track_id: getTrackIdFromUri(currentUri),
        position_ms: positionMs,
        title: currentMetadata?.title ?? 'unknown',
      });
    },

    stop: () => {
      const { _player, currentUri, currentMetadata } = get();
      _player?.pause();
      _player?.seekTo(0);
      if (_player) disableLockScreenControls(_player);
      set({ status: 'stopped', positionMs: 0, currentUri: null, currentMetadata: null });

      AnalyticsService.trackEvent('audio_playback_stopped', {
        track_id: getTrackIdFromUri(currentUri),
        title: currentMetadata?.title ?? 'unknown',
      });
    },

    seekTo: (positionMs: number) => {
      const { _player, currentUri, currentMetadata } = get();
      _player?.seekTo(positionMs / 1000);
      set({ positionMs });

      AnalyticsService.trackEvent('audio_seeked', {
        track_id: getTrackIdFromUri(currentUri),
        position_ms: positionMs,
        title: currentMetadata?.title ?? 'unknown',
      });
    },

    rewind: (offsetMs: number) => {
      const { positionMs, seekTo } = get();
      seekTo(Math.max(0, positionMs - offsetMs));
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

      AnalyticsService.trackEvent('audio_playback_started', {
        track_id: getTrackIdFromUri(uri),
        uri,
        title: currentMetadata?.title ?? 'unknown',
        resume: false,
      });
    },

    cancelInterrupt: () => {
      set({ pendingPlayRequest: null });
    },

    setNowPlayingMetadata: (metadata: ExperienceAudioMetadata) => {
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
      const prevStatus = get().status;
      const prevError = get().errorMsg;

      set(partial);

      const currentUri = get().currentUri;
      const trackId = currentUri ? getTrackIdFromUri(currentUri) : 'unknown';
      const title = get().currentMetadata?.title ?? 'unknown';

      // Playback completed naturally
      if (partial.status === 'stopped' && prevStatus === 'playing') {
        AnalyticsService.trackEvent('audio_playback_completed', {
          track_id: trackId,
          title,
        });
      }

      // Playback failed
      if (partial.errorMsg && partial.errorMsg !== prevError) {
        AnalyticsService.trackEvent('audio_playback_failed', {
          track_id: trackId,
          error_msg: partial.errorMsg,
          title,
        });
        AnalyticsService.recordError(
          new Error(partial.errorMsg),
          `Playback failed for track ${trackId}`,
        );
      }
    },
  }),
);
