import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  filterWorldExperiences,
  worldCameraBounds,
  worldDocuments,
  type GeoBounds,
  type UserExperienceFormat,
} from '@sonora/shared';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import LoadingView from '@/components/loading-view';
import { CARD_BG_COLOR_KEYS } from '@/constants/theme';
import { useMapViewConfig } from '@/hooks/use-map-view-config';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { useWorldExperiences } from '@/hooks/use-world-experiences';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwView } from '@/tw';

import ExperienceMap from './experience-map';
import { FOCUS_SETTLE_FALLBACK_MS } from './map-view.types';
import ExperiencePreviewCard from './experience-preview-card';
import type { MapReferencePress, MapWaitState } from './map-view.types';

/** The chips' label for each filter, `null` being "everything". */
/**
 * What each chip says.
 *
 * A format is named once, by `experiences.types.*` — the same words the list screens
 * use — and only the "everything" chip is the world's own: it is the row's extra
 * option, not a type.
 */
const FILTER_LABEL_KEYS: Record<string, TranslationKeys> = {
  all: 'map.world.filterAll',
  trip: 'experiences.types.trip',
  track: 'experiences.types.track',
};

/**
 * The row, in the order it is read: everything, then the guided walks, then the short
 * pieces.
 *
 * Written here and not taken from `USER_EXPERIENCE_FORMATS` on purpose — that list is
 * the format catalogue's own order, used where the order is the catalogue's business.
 * A filter row is a reading order, and the walker should meet the long experiences
 * first; the two must be free to disagree.
 */
const FILTER_OPTIONS = [
  null,
  'trip',
  'track',
] as const satisfies readonly (UserExperienceFormat | null)[];

export interface WorldMapProps {
  /**
   * Variant B: a tap travels to the point before the card opens.
   *
   * The map is the same either way. The camera move is the whole difference, and
   * it is a development choice (`EXPO_PUBLIC_WORLD_MAP_PREVIEW`) while the shape is
   * decided on a device — see `world-preview-variant.ts`.
   */
  centerOnSelect?: boolean;
  testID?: string;
}

/**
 * The one sentence the card says while it cannot draw yet.
 *
 * A first-time transfer is a long, honest wait and it says so with whatever numbers
 * the platform gave: naming it "loading" would hide work the walker is paying for,
 * and a percentage nobody reported would be invented. Every other wait — the payload,
 * the device cache being checked, the style document — is the same short one, and one
 * sentence for it is the point of this card.
 */
function waitMessage(
  wait: MapWaitState | null,
  t: (key: TranslationKeys, options?: Record<string, unknown>) => string,
): string {
  if (!wait?.downloading) return t('map.loadingMap');
  if (wait.progress === null) return t('map.loadingArchive');
  return t('map.loadingArchiveProgress', { progress: Math.round(wait.progress * 100) });
}

/**
 * The Deriva world: every published experience as a point over Umepay, with the
 * path of each trip, and a tap that leads to the experience.
 *
 * MapLibre only, by construction: the renderer is `ExperienceMap`, which is the
 * MapLibre implementation on both platforms. Leaflet is frozen and this feature
 * never reaches it — not through a flag and not through a fallback, because there
 * is no Leaflet branch to fall back to. Which build shows the world at all is the
 * home's decision, and it is the map engine it already resolved.
 *
 * The documents are derived from the experiences payload on every render that can
 * change them (filter, language), never stored: the world is a projection of what
 * the lists already read, so there is no second copy to drift.
 */
export default function WorldMap({ centerOnSelect = false, testID = 'world-map' }: WorldMapProps) {
  const { t, language } = useAppTranslation();
  const colors = useThemeColors();
  const { status, experiences, retry } = useWorldExperiences();
  const [format, setFormat] = useState<UserExperienceFormat | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  /**
   * What a tap asked for, and only what the camera still owes it.
   *
   * Variant B travels before the card opens, so a tap cannot open it directly: the
   * request is the destination the camera is flying to, and `id` makes every tap a
   * new request even when it names the place the previous one did — otherwise
   * tapping the same point twice would look like no change and never open again.
   */
  const [flight, setFlight] = useState<{ slug: string; id: number } | null>(null);
  const [openedSlug, setOpenedSlug] = useState<string | null>(null);
  const requestId = useRef(0);

  const visible = useMemo(() => filterWorldExperiences(experiences, format), [experiences, format]);
  /**
   * MapLibre cannot call the translation layer, so labels are resolved before drawing.
   * The adapter is the hook's, which keeps it stable per language.
   */
  /**
   * The points are drawn in the colour the app already gives each format — the same
   * `RuntimeColors` entry the home's cards and the list rows use — so a Deriva is the
   * same green everywhere. The label is drawn in the ink those cards put on that
   * surface, because a pastel that fills a card cannot carry text over a pale basemap.
   */
  const documents = useMemo(
    () =>
      worldDocuments(visible, {
        language,
        colors: {
          trip: colors[CARD_BG_COLOR_KEYS.trip],
          track: colors[CARD_BG_COLOR_KEYS.track],
        },
        labelColor: colors.homeCardText,
      }),
    [visible, language, colors],
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

  const { source } = useMapViewConfig(worldCenter);

  const regions = useRemoteConfigStore((state) => state.config.map.regions);
  const regionBounds = useMemo<GeoBounds | null>(() => {
    if (source.regionKey === null || source.regionKey === undefined) return null;
    const region = regions[source.regionKey];
    if (!region) return null;
    const [west, south, east, north] = region.bbox;
    return { west, south, east, north };
  }, [regions, source.regionKey]);

  /**
   * The opening frame covers the whole world, not the filtered slice: the chips
   * change what is drawn, and a frame that re-fitted on every toggle would move the
   * place under the walker's thumb (and, on the web renderer, rebuild the map).
   */
  const cameraBounds = useMemo(
    () => worldCameraBounds(experiences, regionBounds),
    [experiences, regionBounds],
  );

  const opened = useMemo(
    () => experiences.find((experience) => experience.slug === openedSlug) ?? null,
    [experiences, openedSlug],
  );

  /** The place the camera is travelling to, in variant B. */
  const traveller = useMemo(
    () =>
      centerOnSelect && flight ? (experiences.find((e) => e.slug === flight.slug) ?? null) : null,
    [centerOnSelect, experiences, flight],
  );

  /**
   * Opens the card once the flight it started has landed.
   *
   * The signal is the camera's, not a clock: a renderer reports that the move it was
   * asked for came to rest, so a walker who pans or pinches during it still gets the
   * card when the travel ends. A tap replaced by another one supersedes the wait, and
   * the walker never gets a card for the point they did not choose last.
   *
   * The flight is cleared with it: the camera owes nothing once it has arrived, and
   * keeping the request would leave `focus` asking for a place already reached — a
   * second tap on that same place would then look like no change at all.
   */
  const landFlight = useCallback(() => {
    if (!flight) return;
    setOpenedSlug(flight.slug);
    setFlight(null);
  }, [flight]);

  /**
   * The dead-man fallback, and the only timer here: a renderer that never reports
   * would otherwise eat the tap. It is longer than any flight, so it can never race
   * the camera, and it reveals the card the walker is already waiting for.
   */
  useEffect(() => {
    if (!flight) return;
    const timer = setTimeout(landFlight, FOCUS_SETTLE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [flight, landFlight]);

  /**
   * A tap reports the reference, and the reference names its experience. Anything
   * else drawn on this map — a trip's path — reports nothing and selects nothing.
   */
  const handleFeaturePress = useCallback(
    (reference: MapReferencePress) => {
      if (!reference.experienceSlug) return;
      requestId.current += 1;
      // Variant A has no travel to wait for: the card is the whole answer.
      if (!centerOnSelect) {
        setOpenedSlug(reference.experienceSlug);
        return;
      }
      setFlight({ slug: reference.experienceSlug, id: requestId.current });
    },
    [centerOnSelect],
  );

  if (status === 'error') {
    return (
      <TwView
        testID={`${testID}-error`}
        className="h-[400px] w-full items-center justify-center gap-2 px-4"
      >
        <ThemedText>{t('map.offlineTitle')}</ThemedText>
        <Button
          label={t('common.retry')}
          accessibilityLabel={t('common.retry')}
          testID="world-map-retry"
          variant="primary"
          size="sm"
          onPress={retry}
        />
      </TwView>
    );
  }

  // The payload has not arrived, so there is no map to draw and nothing to filter: the
  // card waits alone, in the same box the map will take, and it owns the whole message.
  // The surface is the one the map's own pending overlay paints, so the wait does not
  // change color halfway through: the walker is watching one card, not two.
  if (status === 'loading') {
    return (
      <TwView
        testID={`${testID}-loading`}
        className="h-[400px] w-full items-center justify-center rounded-2xl bg-backgroundElement"
      >
        <LoadingView message={waitMessage(null, t)} />
      </TwView>
    );
  }

  // A place with nothing published is not a failure: it is a world with no points
  // yet, and it says so instead of drawing an empty canvas.
  if (experiences.length === 0) {
    return (
      <TwView
        testID={`${testID}-empty`}
        className="h-[400px] w-full items-center justify-center px-6"
      >
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {t('map.world.empty')}
        </ThemedText>
      </TwView>
    );
  }

  /**
   * The filter row, handed to the map as its toolbar.
   *
   * A slot and not a sibling here on purpose: the row belongs to a map that can draw, so
   * letting the renderer place it is what makes a control over an empty card impossible
   * to write — which is what made the home read as two chained loads.
   */
  const filtersRow = (
    // The row is a layout, not a control: labelling it would need `accessible`, which
    // would in turn swallow the chips' own names. Each chip announces itself.
    <TwView className="flex-row items-center gap-2" testID={`${testID}-filters`}>
      {FILTER_OPTIONS.map((option) => {
        const filter = option ?? 'all';
        return (
          <Chip
            key={filter}
            label={t(FILTER_LABEL_KEYS[filter])}
            selected={format === option}
            onPress={() => setFormat(option)}
            testID={`world-filter-${filter}`}
            accessibilityLabel={t(FILTER_LABEL_KEYS[filter])}
          />
        );
      })}
    </TwView>
  );

  return (
    <TwView testID={testID} className="gap-3">
      {/* Height is the axis this map is fitted on: the world's box is taller than it is
          wide, so a short card fits it to the card's height and leaves the sides empty.
          400 dp stops wasting that width without pushing the page's own content out of
          reach; past ~550 dp on a 340 dp-wide card the fit turns horizontal and the extra
          height is empty sky. The card is the renderer's own, so the wait, the draws and
          the caller's line all share one box and nothing jumps. */}
      <ExperienceMap
        testID={`${testID}-canvas`}
        className="relative h-[400px] w-full overflow-hidden rounded-2xl"
        source={source}
        overlays={documents}
        bounds={cameraBounds}
        center={worldCenter ? [worldCenter.longitude, worldCenter.latitude] : undefined}
        focus={traveller ? { latitude: traveller.latitude, longitude: traveller.longitude } : null}
        onFocusSettled={landFlight}
        onFeaturePress={handleFeaturePress}
        // The hub is where an openable experience and the barrio around it are drawn on
        // one frame, so its markers carry their own weight and a tap target wider than the
        // dot. The basemap's own names are left exactly as the document publishes them:
        // the hub's frame is also where the walker learns the names of the places, and a
        // barrio that only appears once they are close enough to be standing in it is a
        // name they never read.
        boldReferences={true}
        showLabels={showLabels}
        toolbar={filtersRow}
        // One wait, in the card, and the same card: the renderer says which stage it is
        // in, and only a transfer it is really paying for gets its own sentence.
        renderPending={(wait) => (
          <TwView
            testID={`${testID}-loading`}
            className="absolute inset-0 z-10 items-center justify-center bg-backgroundElement"
          >
            <LoadingView message={waitMessage(wait, t)} />
          </TwView>
        )}
        // Nothing of that format is published: the map stays, and one honest line says
        // why it is bare, instead of an empty canvas nobody can read. The line is about
        // the filter — the place has places — so it is not the world-empty sentence,
        // which would describe a map with nothing published at all.
        overlay={
          <>
            {/* The labels toggle floats over the map, not beside the filters: it acts on
                the map itself, and a walker who wants to read the names underneath the
                experiences flips it without leaving the frame. */}
            <IconButton
              onPress={() => setShowLabels(!showLabels)}
              variant="outline"
              size="sm"
              className="absolute top-3 right-3 bg-white/95 dark:bg-zinc-800/95 shadow-md z-20 border-0"
              accessibilityLabel={showLabels ? t('map.hideLabels') : t('map.showLabels')}
              testID="toggle-map-labels"
              icon={{
                ios: showLabels ? 'tag.slash.fill' : 'tag.fill',
                android: showLabels ? 'label_off' : 'label',
                web: showLabels ? 'label_off' : 'label',
              }}
            />
            {visible.length === 0 ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                className="absolute inset-x-0 bottom-0 bg-backgroundElement px-3 py-2 text-center"
                testID={`${testID}-filtered-empty`}
              >
                {t('map.world.filteredEmpty')}
              </ThemedText>
            ) : null}
          </>
        }
      />

      <ExperiencePreviewCard
        experience={opened}
        onDismiss={() => {
          setOpenedSlug(null);
          setFlight(null);
        }}
      />
    </TwView>
  );
}
