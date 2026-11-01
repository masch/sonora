import { fireEvent, render, screen } from '@testing-library/react-native';

import { formatPrice } from '@sonora/shared';

import ExperiencePreviewCard from '@/components/map/experience-preview-card';
import { ROUTES } from '@/constants/routes';
import type { PlayableExperience, TrackExperience, TripExperience } from '@/data/experiences';

/**
 * `push` is captured here because the global mock in `jest.setup.ts` hands out a
 * fresh `jest.fn()` on every `useRouter()` call, which nothing could assert on.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const TRIP_ID = '3f6f3d0a-5a6e-4a1c-9a5e-2f4f0c1d7b11';
const TRACK_ID = '8b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a40';

/** A paid trip: every badge the card knows about is present. */
const trip: TripExperience = {
  id: TRIP_ID,
  slug: 'deriva-centro',
  title: 'Deriva del centro',
  description: 'Una deriva por el centro de Umepay.',
  themeKey: 'urban',
  format: 'trip',
  durationSeconds: 2700,
  latitude: -32.212,
  longitude: -64.738,
  free: false,
  price: 1500000,
  currency: 'ARS',
  imageKey: 'trips-deriva-centro-cover',
  geoMode: 'formatDefaultRadius',
  radiusMeters: null,
  audioUrl: null,
  waypoints: [
    {
      id: 'w-1',
      experienceId: TRIP_ID,
      order: 1,
      latitude: -32.214,
      longitude: -64.74,
      radiusMeters: 50,
    },
    {
      id: 'w-2',
      experienceId: TRIP_ID,
      order: 2,
      latitude: -32.216,
      longitude: -64.742,
      radiusMeters: 50,
    },
  ],
};

/** A free track with no description: the card must drop the parts that say nothing. */
const track: TrackExperience = {
  id: TRACK_ID,
  slug: 'texto-maga',
  title: 'Texto maga',
  description: '',
  themeKey: 'poetry',
  format: 'track',
  durationSeconds: 45,
  latitude: -32.216,
  longitude: -64.734,
  free: true,
  price: null,
  currency: 'ARS',
  imageKey: 'tracks-texto-maga-cover',
  geoMode: 'unrestricted',
  radiusMeters: null,
  audioUrl: null,
};

function renderCard(experience: PlayableExperience | null, onDismiss = jest.fn()) {
  return render(<ExperiencePreviewCard experience={experience} onDismiss={onDismiss} />);
}

describe('ExperiencePreviewCard', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('describes the selected experience: title, format, duration, price and body', async () => {
    await renderCard(trip);

    // The title is what the sheet announces and what the cover describes.
    expect(screen.getAllByText(trip.title).length).toBeGreaterThan(0);
    expect(screen.getByTestId('experience-preview-format')).toBeTruthy();
    expect(screen.getByText('experiences.types.trip')).toBeTruthy();
    // The shared label helper resolves through the app's own words, never a second
    // formatting written in the card.
    expect(screen.getByText('map.world.labelDuration')).toBeTruthy();
    expect(screen.getByText(formatPrice(1500000, 'ARS'))).toBeTruthy();
    expect(screen.getByText(trip.description)).toBeTruthy();
    expect(screen.getByTestId('experience-preview-open')).toBeTruthy();
  });

  it('says a free experience is free instead of naming a price', async () => {
    await renderCard(track);

    expect(screen.getByText('experiences.types.track')).toBeTruthy();
    expect(screen.getByText('map.world.labelSeconds')).toBeTruthy();
    expect(screen.getByText('map.world.free')).toBeTruthy();
    // Below a minute the label is seconds, so the minutes label is never drawn here.
    expect(screen.queryByText('map.world.labelDuration')).toBeNull();
  });

  it('draws nothing while no experience is selected', async () => {
    await renderCard(null);

    expect(screen.queryByTestId('experience-preview-card')).toBeNull();
    expect(screen.queryByTestId('experience-preview-open')).toBeNull();
    expect(screen.queryByTestId('experience-preview-price')).toBeNull();
  });

  it('opens the experience detail and dismisses the preview', async () => {
    const onDismiss = jest.fn();
    await renderCard(trip, onDismiss);

    fireEvent.press(screen.getByTestId('experience-preview-open'));

    // The destination is the detail screen that already exists, reached by id and
    // carrying the title the header reads while the screen loads.
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(ROUTES.PATH.POETICS_DETAIL(trip.id, trip.title));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
