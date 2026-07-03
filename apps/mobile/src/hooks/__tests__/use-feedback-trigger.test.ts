import type { LocalTrackMetadata } from '@/data/experiences';
import { act, renderHook } from '@testing-library/react-native';
import { useFeedbackTrigger } from '../use-feedback-trigger';

describe('useFeedbackTrigger', () => {
  describe('audio_end mode', () => {
    it('should show feedback form when audio finishes (transition from false to true)', async () => {
      const track: LocalTrackMetadata = {
        id: 'track-1',
        uuid: '00000000-0000-0000-0000-000000000000',
        title: 'Test Track',
        description: 'Test',
        durationSeconds: 1800,
        startCoordinates: { latitude: 0, longitude: 0 },
        audioRemoteUrl: 'https://example.com/audio.mp3',
        feedbackTrigger: 'audio_end',
        category: 'landscapes',
        subLabel: 'Test',
        imageKey: 'trips-deriva-centro-cover',
      };

      // Start with audio playing (not finished)
      const { result, rerender } = await renderHook(
        ({ didJustFinish }: { didJustFinish: boolean }) =>
          useFeedbackTrigger(track, { didJustFinish }),
        { initialProps: { didJustFinish: false } },
      );

      // Initially not triggered since audio is still playing
      expect(result.current.showFeedback).toBe(false);

      // Audio finishes — trigger transition
      await rerender({ didJustFinish: true });

      expect(result.current.showFeedback).toBe(true);
    });

    it('should NOT show feedback form when audio is still playing', async () => {
      const track: LocalTrackMetadata = {
        id: 'track-1',
        uuid: '00000000-0000-0000-0000-000000000000',
        title: 'Test Track',
        description: 'Test',
        durationSeconds: 1800,
        startCoordinates: { latitude: 0, longitude: 0 },
        audioRemoteUrl: 'https://example.com/audio.mp3',
        feedbackTrigger: 'audio_end',
        category: 'landscapes',
        subLabel: 'Test',
        imageKey: 'trips-deriva-centro-cover',
      };

      const { result } = await renderHook(() =>
        useFeedbackTrigger(track, { didJustFinish: false }),
      );

      expect(result.current.showFeedback).toBe(false);
    });
  });

  describe('geofence mode', () => {
    it('should show feedback form when GPS detects arrival', async () => {
      const track: LocalTrackMetadata = {
        id: 'track-1',
        uuid: '00000000-0000-0000-0000-000000000000',
        title: 'Test Track',
        description: 'Test',
        durationSeconds: 1800,
        startCoordinates: { latitude: 0, longitude: 0 },
        audioRemoteUrl: 'https://example.com/audio.mp3',
        feedbackTrigger: 'geofence',
        category: 'landscapes',
        subLabel: 'Test',
        imageKey: 'trips-deriva-centro-cover',
      };

      // Simulate geofence arrival: was not near, now is near
      const { result, rerender } = await renderHook(
        ({ isNearStart }: { isNearStart: boolean }) => useFeedbackTrigger(track, { isNearStart }),
        { initialProps: { isNearStart: false } },
      );

      // Initially not triggered
      expect(result.current.showFeedback).toBe(false);

      // Arrive at geofence
      await rerender({ isNearStart: true });

      expect(result.current.showFeedback).toBe(true);
    });

    it('should NOT show feedback form when not near geofence', async () => {
      const track: LocalTrackMetadata = {
        id: 'track-1',
        uuid: '00000000-0000-0000-0000-000000000000',
        title: 'Test Track',
        description: 'Test',
        durationSeconds: 1800,
        startCoordinates: { latitude: 0, longitude: 0 },
        audioRemoteUrl: 'https://example.com/audio.mp3',
        feedbackTrigger: 'geofence',
        category: 'landscapes',
        subLabel: 'Test',
        imageKey: 'trips-deriva-centro-cover',
      };

      const { result } = await renderHook(() => useFeedbackTrigger(track, { isNearStart: false }));

      expect(result.current.showFeedback).toBe(false);
    });
  });

  describe('manual mode', () => {
    it('should not auto-show feedback form (view manages button)', async () => {
      const track: LocalTrackMetadata = {
        id: 'track-1',
        uuid: '00000000-0000-0000-0000-000000000000',
        title: 'Test Track',
        description: 'Test',
        durationSeconds: 1800,
        startCoordinates: { latitude: 0, longitude: 0 },
        audioRemoteUrl: 'https://example.com/audio.mp3',
        feedbackTrigger: 'manual',
        category: 'landscapes',
        subLabel: 'Test',
        imageKey: 'trips-deriva-centro-cover',
      };

      const { result } = await renderHook(() => useFeedbackTrigger(track, {}));

      // Manual mode does NOT auto-show — the view renders a button
      expect(result.current.showFeedback).toBe(false);
    });
  });

  describe('no trigger defined', () => {
    it('should not show feedback form', async () => {
      const track: LocalTrackMetadata = {
        id: 'track-1',
        uuid: '00000000-0000-0000-0000-000000000000',
        title: 'Test Track',
        description: 'Test',
        durationSeconds: 1800,
        startCoordinates: { latitude: 0, longitude: 0 },
        audioRemoteUrl: 'https://example.com/audio.mp3',
        category: 'landscapes',
        subLabel: 'Test',
        imageKey: 'trips-deriva-centro-cover',
        // No feedbackTrigger
      };

      const { result } = await renderHook(() => useFeedbackTrigger(track, {}));

      expect(result.current.showFeedback).toBe(false);
    });
  });

  describe('dismiss', () => {
    it('should reset showFeedback to false when dismiss is called', async () => {
      const track: LocalTrackMetadata = {
        id: 'track-1',
        uuid: '00000000-0000-0000-0000-000000000000',
        title: 'Test Track',
        description: 'Test',
        durationSeconds: 1800,
        startCoordinates: { latitude: 0, longitude: 0 },
        audioRemoteUrl: 'https://example.com/audio.mp3',
        feedbackTrigger: 'audio_end',
        category: 'landscapes',
        subLabel: 'Test',
        imageKey: 'trips-deriva-centro-cover',
      };

      // Start with audio playing, then finish to trigger
      const { result, rerender } = await renderHook(
        ({ didJustFinish }: { didJustFinish: boolean }) =>
          useFeedbackTrigger(track, { didJustFinish }),
        { initialProps: { didJustFinish: false } },
      );

      await rerender({ didJustFinish: true });

      expect(result.current.showFeedback).toBe(true);

      await act(() => {
        result.current.dismiss();
      });

      expect(result.current.showFeedback).toBe(false);
    });

    it('dismiss on manual mode is a no-op (stays false)', async () => {
      const track: LocalTrackMetadata = {
        id: 'track-1',
        uuid: '00000000-0000-0000-0000-000000000000',
        title: 'Test Track',
        description: 'Test',
        durationSeconds: 1800,
        startCoordinates: { latitude: 0, longitude: 0 },
        audioRemoteUrl: 'https://example.com/audio.mp3',
        feedbackTrigger: 'manual',
        category: 'landscapes',
        subLabel: 'Test',
        imageKey: 'trips-deriva-centro-cover',
      };

      const { result } = await renderHook(() => useFeedbackTrigger(track, {}));

      expect(result.current.showFeedback).toBe(false);

      await act(() => {
        result.current.dismiss();
      });

      expect(result.current.showFeedback).toBe(false);
    });
  });
});
