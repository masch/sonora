import type { MapLayerGroupId } from '@sonora/shared';
import { create } from 'zustand';

/**
 * The walker's layer choices, by group, for as long as the app run lasts.
 *
 * Memory and nothing else, on purpose: the recorded decision is that the payload
 * wins at every start ("el payload manda en cada arranque"). The app loads its
 * cached or fresh `/config` at launch and re-seeds the selection from
 * `map.layers`, so a file or a database row would be overwritten before anything
 * read it — a write nobody reads, plus a schema and a migration for a choice that
 * is not meant to outlive the run. This module is therefore the whole store: it
 * dies with the process, which is exactly the lifetime the decision describes.
 *
 * What it holds are **overrides**, not a selection: one entry is a decision about
 * one group, and a group the walker never touched has no entry at all. The payload
 * keeps deciding those, at mount and after every remount, so a payload that lands
 * late — or changed while the walker was away — still reaches the map for every
 * group the walker left alone.
 */
export type MapLayerOverrides = Partial<Record<MapLayerGroupId, boolean>>;

interface MapLayerOverridesState {
  /** Only the groups the walker named; every other group is the payload's. */
  overrides: MapLayerOverrides;
  /**
   * Flips one group, from the visibility it has right now.
   *
   * The current value is passed in rather than read here because it comes from the
   * resolved selection — the payload's answer for that group with any earlier
   * override on top — and the store must not carry a second, possibly disagreeing,
   * copy of it. A payload that hides a group and a walker who then flips it means
   * "show it", so flipping the resolved value is the only correct inversion.
   */
  toggleLayer: (id: MapLayerGroupId, currentVisible: boolean) => void;
  /** Forget every choice: the store a fresh app run finds. */
  reset: () => void;
}

export const useMapLayerOverridesStore = create<MapLayerOverridesState>((set) => ({
  overrides: {},

  toggleLayer: (id, currentVisible) =>
    set((state) => ({ overrides: { ...state.overrides, [id]: !currentVisible } })),

  reset: () => set({ overrides: {} }),
}));
