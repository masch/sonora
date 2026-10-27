import { useState } from 'react';

import type { MapLayerGroupId, MapLayerSelection } from '@sonora/shared';

import { Icon } from '@/components/icon';
import { BottomModal } from '@/components/ui/bottom-modal';
import { IconButton } from '@/components/ui/icon-button';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwPressable, TwText, TwView } from '@/tw';

/**
 * The sentence each group is called by, one entry per id the vocabulary defines.
 *
 * Keyed by the id union on purpose: a group the vocabulary grows without a label is
 * a type error here, not a row that renders an empty string on a device.
 */
const LAYER_LABEL_KEYS: Record<MapLayerGroupId, TranslationKeys> = {
  roads: 'map.layers.roads',
  water: 'map.layers.water',
  places: 'map.layers.places',
  pois: 'map.layers.pois',
  boundaries: 'map.layers.boundaries',
  green: 'map.layers.green',
  buildings: 'map.layers.buildings',
};

export interface MapLayersControlProps {
  /**
   * The resolved selection, already in the order the control renders it.
   *
   * The vocabulary decides the order (`MAP_LAYER_GROUPS`), not this component and not
   * the payload: the list arrives ready to draw, one row per entry, as it was handed.
   */
  selection: readonly MapLayerSelection[];
  /** What the walker asked for: one group's new state, by id. */
  onToggle: (id: MapLayerGroupId) => void;
  /**
   * `showLayerControl(configured, capabilities)` as the view computed it.
   *
   * False means the whole action is absent — no trigger and no sheet — because a
   * control with nothing in it is worse than no control.
   */
  allowed: boolean;
}

/**
 * The map's layer selector: its own trigger and its own sheet, in one action.
 *
 * Self-contained on purpose: the `visible` state of the sheet belongs to the action,
 * not to the screen that mounts a map, so no parent declares a flag or renders the
 * modal (AGENTS.md, "self-contained trigger & modal encapsulation"). The control
 * knows no renderer: it is handed a resolved selection and reports the group the
 * walker touched, and whether it may exist at all is decided by the view that
 * resolved it.
 *
 * A row is a compound interactive surface (label, check mark, whole row tappable), so
 * it is a `TwPressable` and not a `Button`; the trigger is the design system's
 * `IconButton`, like the labels control beside it.
 */
export default function MapLayersControl({ selection, onToggle, allowed }: MapLayersControlProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

  if (!allowed) return null;

  return (
    <>
      <IconButton
        onPress={() => setVisible(true)}
        variant="outline"
        size="sm"
        className="absolute top-3 right-12 bg-white/95 dark:bg-zinc-800/95 shadow-md z-20 border-0"
        accessibilityLabel={t('map.layers.title')}
        testID="map-layers-control"
        icon={{ ios: 'square.3.layers.3d', android: 'layers', web: 'layers' }}
      />
      <BottomModal
        visible={visible}
        onDismiss={() => setVisible(false)}
        title={t('map.layers.title')}
        closeButtonTestID="map-layers-close"
      >
        {selection.map((entry) => {
          const name = t(LAYER_LABEL_KEYS[entry.id]);

          return (
            <TwPressable
              key={entry.id}
              onPress={() => onToggle(entry.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: entry.visible }}
              accessibilityLabel={
                entry.visible ? t('map.layers.visible', { name }) : t('map.layers.hidden', { name })
              }
              testID={`map-layer-row-${entry.id}`}
              className="flex-row items-center justify-between gap-3 py-3"
            >
              <TwText className="text-text">{name}</TwText>
              {entry.visible ? (
                <Icon
                  ios="checkmark"
                  android="check"
                  web="check"
                  size={16}
                  tintColor={colors.text}
                />
              ) : (
                <TwView className="h-4 w-4" />
              )}
            </TwPressable>
          );
        })}
      </BottomModal>
    </>
  );
}
