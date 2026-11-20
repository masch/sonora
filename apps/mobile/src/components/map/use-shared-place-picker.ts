import { useCallback, useMemo, useState } from 'react';

import { worldSharedPlaceSlugs, type WorldExperience } from '@sonora/shared';

/**
 * The shared-place picker's own state and decisions.
 *
 * A crowd's member never opens alone: wherever on the marker the press lands — the
 * aggregate, one of the stacked points or its name — the answer is the same picker,
 * the one surface that says the place carries several options and lists them. A
 * choice, in turn, is a decision and not another press: re-entering the press path
 * would find the slug still in the shared set and reopen the same picker.
 *
 * Living here so `WorldMap` stays at the size the doctor gate allows.
 */
export function useSharedPlacePicker(
  experiences: readonly WorldExperience[],
  onPicked: (slug: string) => void,
): {
  /** The shared place the picker is open for, or `null` when it is closed. */
  clusterPick: { longitude: number; latitude: number } | null;
  /** Opens the picker for the place an experience was pressed at. */
  requestPicker: (slug: string) => void;
  /** Resolves the choice: closes the picker and hands the chosen slug over. */
  pick: (slug: string) => void;
  /** Closes the picker without choosing. */
  setClusterPick: (place: { longitude: number; latitude: number } | null) => void;
  /** Whether a slug's published place carries more than one experience. */
  isShared: (slug: string) => boolean;
  /** Whether the open card was reached through a picker choice, not by its own tap. */
  openedFromPicker: boolean;
  /** Clears the flag: a card closed or opened by its own tap owes no list. */
  clearOpenedFromPicker: () => void;
} {
  const [clusterPick, setClusterPick] = useState<{ longitude: number; latitude: number } | null>(
    null,
  );
  /**
   * Whether the open card was reached through the picker: only then does the card
   * owe the walker their list back, and draw the explicit button for it. Every other
   * path to an open card - its own tap, a dismissed flight - is not a choice made
   * inside a list, so the flag clears there.
   */
  const [openedFromPicker, setOpenedFromPicker] = useState(false);

  const sharedPlaceSlugs = useMemo(() => worldSharedPlaceSlugs(experiences), [experiences]);

  const requestPicker = useCallback(
    (slug: string) => {
      const shared = experiences.find((experience) => experience.slug === slug);
      if (shared) setClusterPick({ longitude: shared.longitude, latitude: shared.latitude });
    },
    [experiences],
  );

  const pick = useCallback(
    (slug: string) => {
      setClusterPick(null);
      setOpenedFromPicker(true);
      onPicked(slug);
    },
    [onPicked],
  );

  const clearOpenedFromPicker = useCallback(() => setOpenedFromPicker(false), []);

  return {
    clusterPick,
    setClusterPick,
    requestPicker,
    pick,
    isShared: sharedPlaceSlugs.has.bind(sharedPlaceSlugs),
    openedFromPicker,
    clearOpenedFromPicker,
  };
}
