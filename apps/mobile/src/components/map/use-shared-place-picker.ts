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
 * resolved against the payload with supercluster's own rule, read backwards: both
 * the centre and every published place are projected to web mercator pixels at the
 * pressed zoom (tile extent 512, mercator y), and a place inside the cluster's
 * radius is a member. The projection is supercluster's own, so this rule and the
 * clustering agree on exactly who was grouped; identical coordinates are distance
 * zero, so the shared-place rule and this rule also agree on a crowd.
 */
export function clusterMemberSlugs(
  experiences: readonly WorldExperience[],
  centre: { longitude: number; latitude: number; zoom: number },
): string[] {
  const worldPx = WORLD_CLUSTER_CONFIG.extentPx * 2 ** centre.zoom;
  const radiusPx = WORLD_CLUSTER_CONFIG.radiusPx;
  /** Web mercator's x, in pixels from the antimeridian. */
  const mercX = (longitude: number): number => ((longitude + 180) / 360) * worldPx;
  /** Web mercator's y, in pixels from the north pole. */
  const mercY = (latitude: number): number =>
    ((1 - Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) / Math.PI) / 2) * worldPx;

  const centreX = mercX(centre.longitude);
  const centreY = mercY(centre.latitude);
  return experiences
    .filter((experience) => {
      if (!Number.isFinite(experience.latitude) || !Number.isFinite(experience.longitude)) {
        return false;
      }
      const dx = mercX(experience.longitude) - centreX;
      const dy = mercY(experience.latitude) - centreY;
      return dx * dx + dy * dy <= radiusPx * radiusPx;
    })
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
