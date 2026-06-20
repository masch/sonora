import { renderHook, act } from '@testing-library/react-hooks';
import { useFeedbackTrigger } from '../use-feedback-trigger';
import type { LocalTrackMetadata } from '@/data/experiences';

describe('useFeedbackTrigger', () => {
  describe('audio_end mode', () => {
    it('should show feedback form when audio finishes (transition from false to true)', () => {
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
        imageKey: 'deriva-centro',
      };

      // Start with audio playing (not finished)
      const { result, rerender } = renderHook(
        ({ didJustFinish }: { didJustFinish: boolean }) =>
          useFeedbackTrigger(track, { didJustFinish }),
        { initialProps: { didJustFinish: false } },
      );

      // Initially not triggered since audio is still playing
      expect(result.current.showFeedback).toBe(false);

      // Audio finishes — trigger transition
      rerender({ didJustFinish: true });

      expect(result.current.showFeedback).toBe(true);
    });

    it('should NOT show feedback form when audio is still playing', () => {
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
        imageKey: 'deriva-centro',
      };

      const { result } = renderHook(() => useFeedbackTrigger(track, { didJustFinish: false }));

      expect(result.current.showFeedback).toBe(false);
    });
  });

  describe('geofence mode', () => {
    it('should show feedback form when GPS detects arrival', () => {
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
        imageKey: 'deriva-centro',
      };

      // Simulate geofence arrival: was not near, now is near
      const { result, rerender } = renderHook(
        ({ isNearStart }: { isNearStart: boolean }) => useFeedbackTrigger(track, { isNearStart }),
        { initialProps: { isNearStart: false } },
      );

      // Initially not triggered
      expect(result.current.showFeedback).toBe(false);

      // Arrive at geofence
      rerender({ isNearStart: true });

      expect(result.current.showFeedback).toBe(true);
    });

    it('should NOT show feedback form when not near geofence', () => {
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
        imageKey: 'deriva-centro',
      };

      const { result } = renderHook(() => useFeedbackTrigger(track, { isNearStart: false }));

      expect(result.current.showFeedback).toBe(false);
    });
  });

  describe('manual mode', () => {
    it('should not auto-show feedback form (view manages button)', () => {
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
        imageKey: 'deriva-centro',
      };

      const { result } = renderHook(() => useFeedbackTrigger(track, {}));

      // Manual mode does NOT auto-show — the view renders a button
      expect(result.current.showFeedback).toBe(false);
    });
  });

  describe('no trigger defined', () => {
    it('should not show feedback form', () => {
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
        imageKey: 'deriva-centro',
        // No feedbackTrigger
      };

      const { result } = renderHook(() => useFeedbackTrigger(track, {}));

      expect(result.current.showFeedback).toBe(false);
    });
  });

  describe('dismiss', () => {
    it('should reset showFeedback to false when dismiss is called', () => {
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
        imageKey: 'deriva-centro',
      };

      // Start with audio playing, then finish to trigger
      const { result, rerender } = renderHook(
        ({ didJustFinish }: { didJustFinish: boolean }) =>
          useFeedbackTrigger(track, { didJustFinish }),
        { initialProps: { didJustFinish: false } },
      );

      rerender({ didJustFinish: true });

      expect(result.current.showFeedback).toBe(true);

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.showFeedback).toBe(false);
    });

    it('dismiss on manual mode is a no-op (stays false)', () => {
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
        imageKey: 'deriva-centro',
      };

      const { result } = renderHook(() => useFeedbackTrigger(track, {}));

      expect(result.current.showFeedback).toBe(false);

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.showFeedback).toBe(false);
    });
  });
});
