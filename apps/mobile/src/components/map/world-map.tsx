import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  USER_EXPERIENCE_FORMATS,
  filterWorldExperiences,
  worldCameraBounds,
  worldDocuments,
  type GeoBounds,
  type TranslateKey,
  type UserExperienceFormat,
} from '@sonora/shared';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import LoadingView from '@/components/loading-view';
import { useMapViewConfig } from '@/hooks/use-map-view-config';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { useWorldExperiences } from '@/hooks/use-world-experiences';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { TwView } from '@/tw';

import ExperienceMap from './experience-map';
import { FOCUS_SETTLE_FALLBACK_MS } from './map-view.types';
import ExperiencePreviewCard from './experience-preview-card';
import type { MapReferencePress } from './map-view.types';

/** The chips' label for each filter, `null` being "everything". */
const FILTER_LABEL_KEYS: Record<string, TranslationKeys> = {
  all: 'map.world.filterAll',
  trip: 'map.world.filterTrip',
  track: 'map.world.filterTrack',
};

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
  const { status, experiences, retry } = useWorldExperiences();
  const [format, setFormat] = useState<UserExperienceFormat | null>(null);
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

  /** MapLibre cannot call the translation layer, so labels are resolved before drawing. */
  const translate = useMemo<TranslateKey>(
    () => (key, options) => t(key as never, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` comes from the newest render; the language is the input
    [language],
  );

  const visible = useMemo(() => filterWorldExperiences(experiences, format), [experiences, format]);
  const documents = useMemo(
    () => worldDocuments(visible, { language, translate }),
    [visible, language, translate],
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

  if (status === 'loading') {
    return (
      <TwView testID={`${testID}-loading`} className="h-72 w-full items-center justify-center">
        <LoadingView message={t('map.loadingMap')} />
      </TwView>
    );
  }

  if (status === 'error') {
    return (
      <TwView
        testID={`${testID}-error`}
        className="h-72 w-full items-center justify-center gap-2 px-4"
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

  // A place with nothing published is not a failure: it is a world with no points
  // yet, and it says so instead of drawing an empty canvas.
  if (experiences.length === 0) {
    return (
      <TwView testID={`${testID}-empty`} className="h-72 w-full items-center justify-center px-6">
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {t('map.world.empty')}
        </ThemedText>
      </TwView>
    );
  }

  return (
    <TwView testID={testID} className="gap-3">
      {/* The row is a layout, not a control: labelling it would need `accessible`, which
          would in turn swallow the chips' own names. Each chip announces itself. */}
      <TwView className="flex-row gap-2" testID={`${testID}-filters`}>
        {([null, ...USER_EXPERIENCE_FORMATS] as const).map((option) => {
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

      <TwView className="relative h-72 w-full overflow-hidden rounded-2xl">
        <ExperienceMap
          testID={`${testID}-canvas`}
          className="h-full w-full"
          source={source}
          overlays={documents}
          bounds={cameraBounds}
          center={worldCenter ? [worldCenter.longitude, worldCenter.latitude] : undefined}
          focus={
            traveller ? { latitude: traveller.latitude, longitude: traveller.longitude } : null
          }
          onFocusSettled={landFlight}
          onFeaturePress={handleFeaturePress}
        />

        {/* Nothing of that format is published: the map stays, and one honest line
            says why it is bare, instead of an empty canvas nobody can read. */}
        {visible.length === 0 && (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            className="absolute inset-x-0 bottom-0 bg-backgroundElement px-3 py-2 text-center"
            testID={`${testID}-filtered-empty`}
          >
            {t('map.world.empty')}
          </ThemedText>
        )}
      </TwView>

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
