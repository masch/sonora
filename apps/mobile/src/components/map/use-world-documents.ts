import { useMemo } from 'react';

import {
  worldCameraBounds,
  worldDocuments,
  type MapDocument,
  type SupportedLanguage,
  type WorldExperience,
} from '@sonora/shared';

import { CARD_BG_COLOR_KEYS } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-colors';

/**
 * The world hub's drawn documents and the camera they are fitted on.
 *
 * The documents are derived from the experiences payload on every render that can
 * change them (filter, language, palette), never stored: the world is a projection
 * of what the lists already read, so there is no second copy to drift. The colours
 * are the app's own: a format is drawn in the same entry the home's cards use, in
 * the ink those cards put on that surface.
 *
 * Living here so `WorldMap` stays at the size the doctor gate allows.
 */
export function useWorldDocuments(options: {
  experiences: readonly WorldExperience[];
  visible: readonly WorldExperience[];
  language: SupportedLanguage;
}): {
  documents: MapDocument[];
  /** The place the world stands on: the middle of everything it draws. */
  worldCenter: { latitude: number; longitude: number } | null;
} {
  const { experiences, visible, language } = options;
  const colors = useThemeColors();

  const documents = useMemo(
    () =>
      worldDocuments(visible, {
        language,
        // The side a name grows towards is about the frame, not about what a filter left:
        // the camera stays fitted to the whole world when a chip narrows the map.
        frameLongitudes: experiences.map((experience) => experience.longitude),
        colors: {
          trip: colors[CARD_BG_COLOR_KEYS.trip],
          track: colors[CARD_BG_COLOR_KEYS.track],
        },
        labelColor: colors.homeCardText,
      }),
    [visible, language, colors, experiences],
  );

  /**
   * The place the world stands on: the middle of everything it draws.
   *
   * The region is resolved from that point exactly as a detail screen resolves it
   * from its own experience — one region per place, never a global default — so the
   * world draws the same archive the screens do and costs nothing more.
   */
  const worldCenter = useMemo(() => {
    const bounds = worldCameraBounds(experiences, null);
    if (!bounds) return null;
    return {
      latitude: (bounds.south + bounds.north) / 2,
      longitude: (bounds.west + bounds.east) / 2,
    };
  }, [experiences]);

  return { documents, worldCenter };
}
