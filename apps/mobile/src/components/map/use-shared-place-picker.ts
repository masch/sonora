import { useCallback, useMemo, useState } from 'react';

import {
  worldPlaceGroups,
  worldSharedPlaceSlugs,
  WORLD_CLUSTER_CONFIG,
  type WorldExperience,
} from '@sonora/shared';

/**
 * The shared-place picker's own state and decisions.
 *
 * A crowd's member never opens alone: wherever on the marker the press lands — the
 * aggregate, one of the stacked points or its name — the answer is the same picker,
 * the one surface that says the place carries several options and lists them. A
 * choice, in turn, is a decision and not another press: re-entering the press path
 * would find the slug still in the shared set and reopen the same picker.
 *
 * The picker's list is a set of slugs, decided once by whoever opens it: a shared
 * place lists its whole group (`worldPlaceGroups`'s rule), and a pressed cluster
 * lists the slugs its press path resolved. The modal itself never re-decides
 * membership, so the map and the list can never disagree.
 *
 * Living here so `WorldMap` stays at the size the doctor gate allows.
 */
/**
 * The slugs of the experiences one pressed cluster stands for.
 *
 * Native has no source ref to expand the cluster through, so the members are
 * resolved against the payload with supercluster's own rule, read backwards: the
 * cluster's pixel radius at the pressed zoom spans a circle of degrees around its
 * centre, and every published place inside that circle is a member. Identical
 * coordinates are always members of each other's cluster, so the shared-place rule
 * and this rule agree on a crowd; nearby-but-distinct places land here too, which
 * is what the walker pressed for.
 */
export function clusterMemberSlugs(
  experiences: readonly WorldExperience[],
  centre: { longitude: number; latitude: number; zoom: number },
): string[] {
  const worldPx = WORLD_CLUSTER_CONFIG.tileSizePx * 2 ** centre.zoom;
  const radiusDegrees = (WORLD_CLUSTER_CONFIG.radiusPx / worldPx) * 360;
  return experiences
    .filter(
      (experience) =>
        Number.isFinite(experience.latitude) &&
        Number.isFinite(experience.longitude) &&
        Math.abs(experience.longitude - centre.longitude) * Math.cos(centre.latitude) <=
          radiusDegrees &&
        Math.abs(experience.latitude - centre.latitude) <= radiusDegrees,
    )
    .map((experience) => experience.slug);
}

export function useSharedPlacePicker(
  experiences: readonly WorldExperience[],
  onPicked: (slug: string) => void,
): {
  /** The slugs the open picker lists, or `null` while it is closed. */
  pickerSlugs: readonly string[] | null;
  /** Opens the picker for the place an experience was pressed at. */
  requestPicker: (slug: string) => void;
  /** Opens the picker for a pressed cluster, listing the places it stands for. */
  openPickerWith: (slugs: readonly string[]) => void;
  /** Resolves the choice: closes the picker and hands the chosen slug over. */
  pick: (slug: string) => void;
  /** Closes the picker without choosing. */
  closePicker: () => void;
  /** Whether a slug's published place carries more than one experience. */
  isShared: (slug: string) => boolean;
  /** Whether the open card was reached through a picker choice, not by its own tap. */
  openedFromPicker: boolean;
  /** Clears the flag: a card closed or opened by its own tap owes no list. */
  clearOpenedFromPicker: () => void;
} {
  const [pickerSlugs, setPickerSlugs] = useState<readonly string[] | null>(null);
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
      const place = experiences.find((experience) => experience.slug === slug);
      if (!place) {
        setPickerSlugs(null);
        return;
      }
      const group = worldPlaceGroups(experiences).get(
        // The same millionth-degree key the map drew the crowd with.
        `${Math.round(place.latitude * 1e6)}:${Math.round(place.longitude * 1e6)}`,
      );
      setPickerSlugs(group === undefined ? null : group.map((experience) => experience.slug));
    },
    [experiences],
  );

  const pick = useCallback(
    (slug: string) => {
      setPickerSlugs(null);
      setOpenedFromPicker(true);
      onPicked(slug);
    },
    [onPicked],
  );

  const closePicker = useCallback(() => setPickerSlugs(null), []);
  const openPickerWith = useCallback((slugs: readonly string[]) => setPickerSlugs(slugs), []);
  const clearOpenedFromPicker = useCallback(() => setOpenedFromPicker(false), []);

  return {
    pickerSlugs,
    closePicker,
    requestPicker,
    openPickerWith,
    pick,
    isShared: sharedPlaceSlugs.has.bind(sharedPlaceSlugs),
    openedFromPicker,
    clearOpenedFromPicker,
  };
}
