export type FeedbackTriggerMode = 'audio_end' | 'geofence' | 'manual';

export interface LocalTrackMetadata {
  id: string;
  uuid: string;
  title: string;
  description: string;
  durationSeconds: number;
  startCoordinates: {
    latitude: number;
    longitude: number;
  };
  audioRemoteUrl: string;
  feedbackTrigger?: FeedbackTriggerMode;
  category: 'birds' | 'stories' | 'landscapes' | 'poems' | 'community' | 'children';
  subLabel: string;
  sectionsCount?: number;
  distanceMeters?: number;
  priceLabel?: string;
  typeLabel?: string;
  isDownloadable?: boolean;
  imageKey:
    | 'deriva-centro'
    | 'bonus-track'
    | 'tacuarita-azul'
    | 'el-arroyo'
    | 'la-piedra-antigua'
    | 'viento-chanares'
    | 'voces-monte';
}

export const TRACKS: Record<string, LocalTrackMetadata> = {
  'umepay-bosque': {
    id: 'umepay-bosque',
    uuid: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    title: 'DERIVA POR EL CENTRO',
    description: 'Deriva por el centro, 3 secciones, 600mts',
    durationSeconds: 2700,
    startCoordinates: {
      latitude: -32.211913,
      longitude: -64.73809012343702,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    feedbackTrigger: 'manual',
    category: 'landscapes',
    subLabel: 'Caminata guiada',
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
    durationSeconds: 600,
    startCoordinates: {
      latitude: -32.211015,
      longitude: -64.73809012343702,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    category: 'community',
    subLabel: 'Mindfulness',
    sectionsCount: 0,
    distanceMeters: 0,
    priceLabel: 'FREE',
    typeLabel: 'Mindfulness',
    isDownloadable: false,
    imageKey: 'bonus-track',
  },
  'tacuarita-azul': {
    id: 'tacuarita-azul',
    uuid: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    title: 'Tacuarita Azul',
    description: 'Paisaje sonoro',
    durationSeconds: 240,
    startCoordinates: {
      latitude: -32.2115,
      longitude: -64.7385,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    category: 'landscapes',
    subLabel: 'Paisaje sonoro',
    imageKey: 'tacuarita-azul',
  },
  'el-arroyo': {
    id: 'el-arroyo',
    uuid: '2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
    title: 'El arroyo',
    description: 'Historia',
    durationSeconds: 420,
    startCoordinates: {
      latitude: -32.212,
      longitude: -64.739,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    category: 'stories',
    subLabel: 'Historia',
    imageKey: 'el-arroyo',
  },
  'la-piedra-antigua': {
    id: 'la-piedra-antigua',
    uuid: '3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d',
    title: 'La piedra antigua',
    description: 'Poema',
    durationSeconds: 180,
    startCoordinates: {
      latitude: -32.2125,
      longitude: -64.7395,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    category: 'poems',
    subLabel: 'Poema',
    imageKey: 'la-piedra-antigua',
  },
  'viento-chanares': {
    id: 'viento-chanares',
    uuid: '4a5b6c7d-8e9f-0a1b-2c3d-4e5f6a7b8c9d',
    title: 'Viento en los chañares',
    description: 'Paisaje sonoro',
    durationSeconds: 300,
    startCoordinates: {
      latitude: -32.213,
      longitude: -64.74,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    category: 'landscapes',
    subLabel: 'Paisaje sonoro',
    imageKey: 'viento-chanares',
  },
  'voces-monte': {
    id: 'voces-monte',
    uuid: '5a6b7c8d-9e0f-1a2b-3c4d-5e6f7a8b9c0d',
    title: 'Voces del monte',
    description: 'Comunidad',
    durationSeconds: 420,
    startCoordinates: {
      latitude: -32.2135,
      longitude: -64.7405,
    },
    audioRemoteUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    category: 'community',
    subLabel: 'Comunidad',
    imageKey: 'voces-monte',
  },
};
