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
  // Extra fields for the mockup format
  sectionsCount?: number;
  distanceMeters?: number;
  priceLabel?: string;
  typeLabel?: string;
  isDownloadable?: boolean;
  imageKey?: string;
}

export const TRIPS: Record<string, LocalTripMetadata> = {
  'umepay-bosque': {
    id: 'umepay-bosque',
    uuid: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    title: 'DERIVA POR EL CENTRO',
    description: 'Deriva por el centro, 3 secciones, 600mts',
    durationMinutes: 45,
    startCoordinates: {
      latitude: -32.211913,
      longitude: -64.73809012343702,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    feedbackTrigger: 'manual',
    sectionsCount: 3,
    distanceMeters: 600,
    priceLabel: '15 mil $',
    isDownloadable: true,
    imageKey: 'deriva-centro',
  },
  'rio-claro': {
    id: 'rio-claro',
    uuid: '5a9463ce-daba-4756-892e-4dd4cb862309',
    title: 'BONUS TRACK',
    description: 'Mindfulness',
    durationMinutes: 10,
    startCoordinates: {
      latitude: -32.211015,
      longitude: -64.73809012343702,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    sectionsCount: 0,
    distanceMeters: 0,
    priceLabel: 'FREE',
    typeLabel: 'Mindfulness',
    isDownloadable: false,
    imageKey: 'bonus-track',
  },
};

export function getTripById(id: string): LocalTripMetadata | undefined {
  return TRIPS[id];
}

export function getAllTrips(): LocalTripMetadata[] {
  return Object.values(TRIPS);
}
