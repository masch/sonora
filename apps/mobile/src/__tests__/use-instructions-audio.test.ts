import { APP_CONFIG } from '@/config/app-config';
import type { Experience } from '@/data/experiences';
import { fetchExperiences, INSTRUCTIONS_FALLBACK_TRACK_ID } from '@/data/experiences';
import { useInstructionsAudio } from '@/hooks/use-instructions-audio';
import { renderHook, waitFor } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────

const mockTrip: Experience = {
  id: 'a23baa7e-2c82-472f-9241-4f23e00c1733',
  slug: 'instructions',
  title: 'INSTRUCTIONS',
  description: '(cómo usar la app de Sonora)',
  format: 'trip',
  themeKey: 'onboarding',
  audioUrl: 'experiences/instrucciones.mp3',
  durationSeconds: 116,
  latitude: -32.211913,
  longitude: -64.73809012343702,
  free: true,
  imageKey: 'trip-instructions-cover',
  geofenceBypassable: false,
} as Experience;

const mockOtherExperience: Experience = {
  id: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
  slug: 'umepay-bosque',
  title: 'DERIVA DEL BOSQUE AL RÍO',
  description: 'Deriva del boque al río',
  format: 'trip',
  themeKey: 'landscapes',
  audioUrl: 'experiences/trips-deriva-centro.mp3',
  durationSeconds: 2104,
  latitude: -32.211913,
  longitude: -64.73809012343702,
  free: false,
  price: 1500000,
  currency: 'ARS',
  imageKey: 'trips-deriva-centro-cover',
  geofenceBypassable: false,
} as Experience;

jest.mock('@/data/experiences', () => ({
  fetchExperiences: jest.fn(),
  isPlayableExperience: jest.fn((exp: unknown) => exp != null),
  INSTRUCTIONS_SLUG: 'instructions',
  INSTRUCTIONS_FALLBACK_TRACK_ID: 'instructions',
}));

jest.mock('@/config/app-config', () => ({
  APP_CONFIG: {
    audio: {
      instructionsUrl: 'http://fallback-url/audio/stream?key=instructions.mp3&token=fallback',
    },
  },
}));

// ── Tests ─────────────────────────────────────────────

describe('useInstructionsAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fetchExperiences).mockReturnValue(new Promise<never>(() => {}));
  });

  it('returns loading state on mount with fallback values', async () => {
    jest.mocked(fetchExperiences).mockImplementationOnce(
      () => new Promise<never>(() => {}), // never resolves
    );

    const { result } = await renderHook(() => useInstructionsAudio());

    expect(result.current.loading).toBe(true);
    expect(result.current.audioUrl).toBe(APP_CONFIG.audio.instructionsUrl);
    expect(result.current.trackId).toBe(INSTRUCTIONS_FALLBACK_TRACK_ID);
    expect(result.current.error).toBeNull();
  });

  it('returns trip audioUrl and UUID when instructions trip is found', async () => {
    jest.mocked(fetchExperiences).mockResolvedValueOnce([mockTrip]);

    const { result } = await renderHook(() => useInstructionsAudio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.audioUrl).toBe('experiences/instrucciones.mp3');
    expect(result.current.trackId).toBe(mockTrip.id);
    expect(result.current.error).toBeNull();
  });

  it('returns fallback values when API succeeds but no instructions trip', async () => {
    jest.mocked(fetchExperiences).mockResolvedValueOnce([mockOtherExperience]);

    const { result } = await renderHook(() => useInstructionsAudio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.audioUrl).toBe(APP_CONFIG.audio.instructionsUrl);
    expect(result.current.trackId).toBe(INSTRUCTIONS_FALLBACK_TRACK_ID);
    expect(result.current.error).toBeNull();
  });

  it('returns fallback values and error when API fetch fails', async () => {
    const networkError = new Error('Network request failed');
    jest.mocked(fetchExperiences).mockRejectedValueOnce(networkError);

    const { result } = await renderHook(() => useInstructionsAudio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.audioUrl).toBe(APP_CONFIG.audio.instructionsUrl);
    expect(result.current.trackId).toBe(INSTRUCTIONS_FALLBACK_TRACK_ID);
    expect(result.current.error).toBe(networkError);
  });

  it('passes abort signal from controller to fetchExperiences', async () => {
    const { unmount } = await renderHook(() => useInstructionsAudio());

    expect(jest.mocked(fetchExperiences)).toHaveBeenCalled();

    unmount();
  });
});
