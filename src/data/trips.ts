export interface LocalTripMetadata {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  startCoordinates: {
    latitude: number;
    longitude: number;
  };
  audioRemoteUrl: string;
}

export const TRIPS: Record<string, LocalTripMetadata> = {
  'umepay-bosque': {
    id: 'umepay-bosque',
    title: 'Umepay Bosque Antiguo',
    description:
      'A meditative walk through the ancient forest of Umepay, following the path carved by centuries of wind and water.',
    durationMinutes: 45,
    startCoordinates: {
      latitude: -32.21218267316605,
      longitude: -64.73809012343702,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
};

export function getTripById(id: string): LocalTripMetadata | undefined {
  return TRIPS[id];
}

export function getAllTrips(): LocalTripMetadata[] {
  return Object.values(TRIPS);
}
