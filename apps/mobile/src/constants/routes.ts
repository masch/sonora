import { ENTITY_NAMES } from './entities';

export const ROUTES = {
  HOME: 'index',
  DERIVAS: ENTITY_NAMES.DERIVAS,
  POETICS: ENTITY_NAMES.POETICS,
  EXPLORE: 'explore',
  SETTINGS: 'settings',
  MESSAGES: 'messages',

  // Path helpers for router navigation
  PATH: {
    HOME: '/',
    DERIVAS: `/${ENTITY_NAMES.DERIVAS}`,
    POETICS: `/${ENTITY_NAMES.POETICS}`,
    POETICS_DETAIL: (id: string, title?: string) =>
      (title
        ? `/${ENTITY_NAMES.POETICS}/${id}?title=${encodeURIComponent(title)}`
        : `/${ENTITY_NAMES.POETICS}/${id}`) as import('expo-router').Href,
    MESSAGES: '/messages',
  },
} as const;
