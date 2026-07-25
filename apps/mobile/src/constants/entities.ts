export const ENTITY_NAMES = {
  DERIVAS: 'derivas',
  POETICS: 'poetics',
  EXPERIENCES: 'experiences',
} as const;

export type EntityType = (typeof ENTITY_NAMES)[keyof typeof ENTITY_NAMES];
