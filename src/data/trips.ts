export type FeedbackTriggerMode = 'audio_end' | 'geofence' | 'manual';

export interface LocalTripMetadata {
  id: string;
  /** UUID for API FK references (trips.id in Postgres) */
  uuid: string;
  title: string;
  description: string;
  durationMinutes: number;
  startCoordinates: {
    latitude: number;
    longitude: number;
  };
  audioRemoteUrl: string;
  feedbackTrigger?: FeedbackTriggerMode;
}

export const TRIPS: Record<string, LocalTripMetadata> = {
  'umepay-bosque': {
    id: 'umepay-bosque',
    uuid: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    title: 'Umepay Bosque Antiguo',
    description:
      'A meditative walk through the ancient forest of Umepay, following the path carved by centuries of wind and water.',
    durationMinutes: 45,
    startCoordinates: {
      // 30 m north of the original point (1° lat ≈ 111 320 m)
      latitude: -32.211913,
      longitude: -64.73809012343702,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    feedbackTrigger: 'manual',
  },
  'rio-claro': {
    id: 'rio-claro',
    uuid: '5a9463ce-daba-4756-892e-4dd4cb862309',
    title: 'Río Claro',
    description:
      'A gentle walk along the crystal-clear river, with the sound of water guiding every step through shaded banks.',
    durationMinutes: 30,
    startCoordinates: {
      // 100 m north of Umepay Bosque (1° lat ≈ 111 320 m)
      latitude: -32.211015,
      longitude: -64.73809012343702,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  'cerro-pintado': {
    id: 'cerro-pintado',
    uuid: '992d375f-4efa-4551-bb2c-155f163c2e1b',
    title: 'Cerro Pintado',
    description:
      'A rewarding ascent through layered rock formations to a summit with panoramic views of the Sierras Grandes.',
    durationMinutes: 75,
    startCoordinates: {
      // 200 m northeast of Umepay Bosque (1° lat ≈ 111 320 m, 1° lng ≈ 94 180 m)
      latitude: -32.210116,
      longitude: -64.735966,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
};

export function getTripById(id: string): LocalTripMetadata | undefined {
  return TRIPS[id];
}

export function getAllTrips(): LocalTripMetadata[] {
  return Object.values(TRIPS);
}
