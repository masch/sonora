import {
  DEFAULT_REMOTE_CONFIG as mockDefaultRemoteConfig,
  type RemoteConfigPayload,
} from '@sonora/shared';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { useInstructionsAudio } from '@/hooks/use-instructions-audio';
import { renderHook } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────

// A real zustand store backing the mocked module, so tests drive it with
// `useRemoteConfigStore.setState` exactly like the app runtime does.
jest.mock('@/store/remote-config-store', () => {
  const { create } = jest.requireActual('zustand') as typeof import('zustand');
  return {
    useRemoteConfigStore: create(() => ({
      config: jest.requireActual('@sonora/shared').DEFAULT_REMOTE_CONFIG as RemoteConfigPayload,
      isLoading: false,
      error: null,
      versionStatus: 'ok',
      liveConfigApplied: false,
      init: jest.fn(),
      refetch: jest.fn(() => false),
    })),
  };
});

// Mirrors what `/config` serves: the compiled audioKey plus the derived url.
const configWithInstructions: RemoteConfigPayload = {
  ...mockDefaultRemoteConfig,
  experiences: {
    trip: {
      instructions: {
        slug: 'instructions-trip',
        audioKey: 'instructions/trip.mp3',
        audioUrl: 'https://audio.example.com/instructions-trip.mp3',
        route: '/derivas',
      },
    },
    track: {
      instructions: {
        slug: 'instructions-track',
        audioKey: 'instructions/track.mp3',
        audioUrl: 'https://audio.example.com/instructions-track.mp3',
        route: '/poetics',
      },
    },
  },
} as RemoteConfigPayload;

function setStore(
  patch: Partial<{ config: RemoteConfigPayload; isLoading: boolean; error: Error | null }>,
) {
  useRemoteConfigStore.setState(patch as never);
}

// ── Tests ─────────────────────────────────────────────

describe('useInstructionsAudio', () => {
  beforeEach(() => {
    setStore({ config: mockDefaultRemoteConfig, isLoading: false, error: null });
  });

  it('returns null audioUrl and trackId when the format has no instructions node', async () => {
    const { result } = await renderHook(() => useInstructionsAudio('trip'));

    expect(result.current.instructions).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns trip instructions slug and audioUrl from the remote config', async () => {
    setStore({ config: configWithInstructions });

    const { result } = await renderHook(() => useInstructionsAudio('trip'));

    expect(result.current.instructions).toEqual({
      slug: 'instructions-trip',
      audioUrl: 'https://audio.example.com/instructions-trip.mp3',
    });
    expect(result.current.error).toBeNull();
  });

  it('returns track instructions slug and audioUrl when format is track', async () => {
    setStore({ config: configWithInstructions });

    const { result } = await renderHook(() => useInstructionsAudio('track'));

    expect(result.current.instructions).toEqual({
      slug: 'instructions-track',
      audioUrl: 'https://audio.example.com/instructions-track.mp3',
    });
    expect(result.current.error).toBeNull();
  });

  it('returns a null node for a configured format missing from the config', async () => {
    setStore({
      config: {
        ...configWithInstructions,
        experiences: { trip: configWithInstructions.experiences.trip! },
      },
    });

    const { result } = await renderHook(() => useInstructionsAudio('track'));

    expect(result.current.instructions).toBeNull();
  });

  it('reports loading while the remote config has not answered', async () => {
    setStore({ isLoading: true });

    const { result } = await renderHook(() => useInstructionsAudio('trip'));

    expect(result.current.loading).toBe(true);
  });

  it('propagates the remote config error', async () => {
    const configError = new Error('config fetch failed');
    setStore({ error: configError });

    const { result } = await renderHook(() => useInstructionsAudio('trip'));

    expect(result.current.error).toBe(configError);
  });
});
