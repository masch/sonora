import { isMapLayerGroupId, type MapLayerGroupId } from '@sonora/shared';

/**
 * The parser both layer switches share: only the word `true` turns one on.
 *
 * Both answer "may a field about the selector travel / may the walker see the
 * selector", and both fail towards today's behaviour: an unset, empty or
 * misspelled variable is off. The direction matters for `MAP_LAYERS_WIRE` — on
 * means publishing a key that the builds in the field before the tolerant schema
 * reject whole, so a typo has to withhold it, never publish it.
 */
export function normalizeFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/** One entry of `map.layers.groups`, as the wire carries it. */
export interface ServedLayerGroup {
  id: MapLayerGroupId;
  defaultVisible: boolean;
}

/**
 * Normalizes `MAP_LAYERS_GROUPS`: a comma-separated list of group ids, in the
 * order the control will render them (an entry per line the operator wrote, so
 * reordering the selector is editing this variable, not shipping a build).
 *
 * A leading dash means the group draws nothing until the walker asks for it
 * (`-buildings`); without it the group is drawn when the experience opens. The
 * order is the server's, which is why this keeps the written order instead of
 * sorting by the vocabulary.
 *
 * An id this build does not implement is dropped rather than passed along: the
 * vocabulary is compiled into this server, so the only ids that can reach here
 * unknown are typos, and a typo on the wire would become a row the client
 * silently ignores. The client keeps dropping unknown ids for the other
 * direction — a payload written by a newer server.
 */
export function normalizeLayerGroups(value: string | undefined): ServedLayerGroup[] {
  if (!value) return [];

  // `Map` keeps the first insertion order, which is the order to render in.
  const groups = new Map<MapLayerGroupId, boolean>();
  for (const part of value.split(',')) {
    const entry = part.trim();
    const hidden = entry.startsWith('-');
    const id = hidden ? entry.slice(1).trim() : entry;

    // First mention wins: two entries for one group would give the control two
    // rows that disagree about the same layer.
    if (!isMapLayerGroupId(id) || groups.has(id)) continue;
    groups.set(id, !hidden);
  }

  return [...groups].map(([id, defaultVisible]) => ({ id, defaultVisible }));
}
