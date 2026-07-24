import { useState, useEffect } from 'react';
import { FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import LoadingView from '@/components/loading-view';
import { TwView, TwTextInput, TwPressable } from '@/tw';
import { TwImage } from '@/tw/image';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { fetchThemes, fetchExperiences, USER_EXPERIENCE_FORMATS } from '@/data/experiences';
import type { Theme, Experience, ExperienceFormat } from '@/data/experiences';
import type { TranslationKeys } from '@/i18n/types';
import {
  TRACK_IMAGES,
  SONORA_TRIP_BG,
  SONORA_TRACKS_BG,
  DEFAULT_TRACK_IMAGE,
} from '@/constants/images';
import { ROUTES } from '@/constants/routes';
import { logger } from '@/utils/logger';

const FETCH_TIMEOUT_MS = 10_000;

const CARD_BG_COLOR_KEYS: Record<
  ExperienceFormat,
  'homeExploreRoutesBg' | 'homeExploreTracksBg' | 'homeLocalMessagesBg'
> = {
  trip: 'homeExploreRoutesBg',
  track: 'homeExploreTracksBg',
  'general-feedback': 'homeLocalMessagesBg',
};

export default function ExperiencesScreen({ format }: { format?: ExperienceFormat }) {
  const params = useLocalSearchParams<{ format?: string }>();
  const lockedFormat = format || params.format;
  const isFormatLocked = format
    ? true
    : params.format
      ? (USER_EXPERIENCE_FORMATS as readonly string[]).includes(params.format)
      : false;
  const initialFormat: ExperienceFormat = isFormatLocked
    ? (lockedFormat as ExperienceFormat)
    : 'track';

  const { t } = useAppTranslation();
  const [themesList, setThemesList] = useState<Theme[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    try {
      const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const [fetchedThemes, fetchedExps] = await Promise.all([
        fetchThemes(signal),
        fetchExperiences(signal),
      ]);
      setThemesList(fetchedThemes);
      setExperiences(fetchedExps);
      setError(false);
    } catch (err) {
      logger.error('Failed to load dynamic data:', err);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    const abort = new AbortController();

    const timeoutId = setTimeout(() => {
      abort.abort();
      logger.error('Failed to load dynamic data: Request timed out');
      setError(true);
      setLoading(false);
    }, FETCH_TIMEOUT_MS);

    Promise.all([fetchThemes(abort.signal), fetchExperiences(abort.signal)])
      .then(([fetchedThemes, fetchedExps]) => {
        clearTimeout(timeoutId);
        if (abort.signal.aborted) return;
        setThemesList(fetchedThemes);
        setExperiences(fetchedExps);
        setError(false);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (abort.signal.aborted) return;
        logger.error('Failed to load dynamic data:', err);
        setError(true);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      abort.abort();
    };
  }, []);

  if (error) {
    return (
      <TwView className="flex-grow items-center justify-center p-6 bg-background">
        <ThemedText className="text-base font-bold text-text mb-4 text-center">
          {t('experiences.errorLoading')}
        </ThemedText>

        <TwPressable
          onPress={loadData}
          className="px-6 py-2.5 bg-text rounded-xl active:opacity-75"
          testID="experiences-retry-button"
          accessibilityLabel={t('experiences.retry')}
        >
          <ThemedText themeColor="background" className="font-semibold">
            {t('experiences.retry')}
          </ThemedText>
        </TwPressable>
      </TwView>
    );
  }

  if (loading) {
    return <LoadingView message={t('experiences.loading')} />;
  }

  return (
    <ExperiencesContent
      key={lockedFormat}
      experiences={experiences}
      themesList={themesList}
      isFormatLocked={isFormatLocked}
      initialFormat={initialFormat}
    />
  );
}

function ExperiencesContent({
  experiences,
  themesList,
  isFormatLocked,
  initialFormat,
}: {
  experiences: Experience[];
  themesList: Theme[];
  isFormatLocked: boolean;
  initialFormat: ExperienceFormat;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useAppTranslation();
  const [selectedFormat, setSelectedFormat] = useState<ExperienceFormat>(initialFormat);
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const themeOptions = [
    {
      key: 'all',
      labelKey: 'experiences.categories.all' as TranslationKeys,
      order: 0,
      applicableFormat: null,
    },
    ...themesList.reduce<
      { key: string; labelKey: TranslationKeys; order: number; applicableFormat: string | null }[]
    >((acc, theme) => {
      if (
        theme.applicableFormat === null ||
        theme.applicableFormat === undefined ||
        theme.applicableFormat === selectedFormat
      ) {
        acc.push({
          key: theme.key,
          labelKey: theme.labelKey as TranslationKeys,
          order: theme.order,
          applicableFormat: theme.applicableFormat as string | null,
        });
      }
      return acc;
    }, []),
  ];

  const filteredExperiences = experiences.filter((exp) => {
    const matchesTheme = selectedTheme === 'all' || exp.themeKey === selectedTheme;
    const matchesFormat = exp.format === selectedFormat;
    const matchesSearch =
      exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTheme && matchesFormat && matchesSearch;
  });

  const isTrip = selectedFormat === 'trip';
  const isTrack = selectedFormat === 'track';
  const backgroundImg = isTrip ? SONORA_TRIP_BG : isTrack ? SONORA_TRACKS_BG : null;

  return (
    <ScrollScreenWrapper
      disableBottomPadding
      backgroundImage={backgroundImg || undefined}
      contentContainerClassName="grow pb-8 px-6 pt-4"
    >
      <TwView className="items-center py-4">
        <ThemedText className="text-xl font-bold tracking-widest text-text uppercase">
          {t(`experiences.types.${selectedFormat}` as TranslationKeys)}
        </ThemedText>
      </TwView>

      {!isFormatLocked && (
        <TwView className="flex-row gap-2 mb-4 justify-center">
          {USER_EXPERIENCE_FORMATS.map((format) => {
            const isSelected = selectedFormat === format;
            const translationKey = `experiences.types.${format}` as TranslationKeys;
            return (
              <TwPressable
                key={format}
                onPress={() => {
                  setSelectedFormat(format);
                  setSelectedTheme('all');
                }}
                className={`px-4 py-1.5 rounded-lg border ${
                  isSelected
                    ? 'bg-text border-text'
                    : 'bg-zinc-200/10 dark:bg-zinc-800/10 border-zinc-300/40 dark:border-zinc-700/40'
                } active:opacity-75`}
                testID={`type-chip-${format}`}
                accessibilityLabel={t(translationKey)}
              >
                <ThemedText
                  themeColor={isSelected ? 'background' : 'text'}
                  className="text-xs font-bold capitalize"
                >
                  {t(translationKey)}
                </ThemedText>
              </TwPressable>
            );
          })}
        </TwView>
      )}

      <TwView className="flex-row items-center gap-2 mb-4">
        <TwView className="flex-1 flex-row items-center bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-300/30 dark:border-zinc-700/30 rounded-xl px-3 py-2.5">
          <Icon
            ios="magnifyingglass"
            android="search"
            web="search"
            size={18}
            tintColor={colors.textSecondary}
          />
          <TwTextInput
            placeholder={t(`experiences.searchPlaceholder.${selectedFormat}` as TranslationKeys)}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-sm font-medium text-text ml-2 pb-0"
            accessibilityLabel={t(
              `experiences.searchPlaceholder.${selectedFormat}` as TranslationKeys,
            )}
            testID="tracks-search-input"
          />
        </TwView>
      </TwView>

      <TwView className="mb-6 -mx-6">
        <FlatList
          data={themeOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-6 gap-2"
          keyExtractor={(item) => item.key}
          renderItem={({ item: theme }) => {
            const isSelected = selectedTheme === theme.key;
            return (
              <TwPressable
                onPress={() => setSelectedTheme(theme.key)}
                className={`px-4 py-2 rounded-full border ${
                  isSelected
                    ? 'bg-text border-text'
                    : 'bg-zinc-200/10 dark:bg-zinc-800/10 border-zinc-300/40 dark:border-zinc-700/40'
                } active:opacity-75`}
                accessibilityLabel={t(theme.labelKey)}
                testID={`category-chip-${theme.key}`}
              >
                <ThemedText
                  themeColor={isSelected ? 'background' : 'text'}
                  className="text-xs font-semibold"
                >
                  {t(theme.labelKey)}
                </ThemedText>
              </TwPressable>
            );
          }}
        />
      </TwView>

      <TwView className="gap-5">
        {filteredExperiences.length === 0 ? (
          <TwView className="items-center py-12" testID="tracks-empty-state">
            <ThemedText
              className="text-textSecondary"
              accessibilityLabel={t('experiences.notFound')}
            >
              {t('experiences.notFound')}
            </ThemedText>
          </TwView>
        ) : (
          filteredExperiences.map((exp) => (
            <TwPressable
              key={exp.id}
              onPress={() => router.push(ROUTES.PATH.POETICS_DETAIL(exp.id, exp.title))}
              className="flex-row items-center gap-4 px-5 py-4 rounded-[24px] active:opacity-75"
              style={{
                backgroundColor: colors[CARD_BG_COLOR_KEYS[exp.format]] + 'CC',
              }}
              testID={`track-row-${exp.slug}`}
              accessibilityLabel={t('experiences.rowAccessibilityLabel', {
                title: exp.title,
                subLabel: exp.description,
                duration: Math.round(exp.durationSeconds / 60),
                minAbbr: t('experiences.minAbbr'),
              })}
            >
              <TwImage
                source={TRACK_IMAGES[exp.imageKey] || DEFAULT_TRACK_IMAGE}
                className="size-16 rounded-xl bg-zinc-200 dark:bg-zinc-800"
                contentFit="cover"
                alt=""
              />

              <TwView className="flex-1 justify-center">
                <ThemedText
                  className="text-sm font-bold leading-tight mb-0.5"
                  style={{ color: colors.homeCardText }}
                >
                  {exp.title}
                </ThemedText>
                <ThemedText
                  className="text-xs leading-normal mb-0.5"
                  style={{ color: colors.homeCardSubtext }}
                >
                  {exp.description}
                </ThemedText>
                <ThemedText
                  className="text-xs font-semibold leading-none"
                  style={{ color: colors.homeCardSubtext }}
                >
                  {Math.round(exp.durationSeconds / 60)} {t('experiences.minAbbr')}
                </ThemedText>
              </TwView>

              <TwPressable
                className="p-2 active:opacity-70"
                accessibilityLabel={t('experiences.actionsMenu')}
                testID={`track-actions-${exp.slug}`}
              >
                <Icon
                  ios="ellipsis"
                  android="more_vert"
                  web="more_vert"
                  size={20}
                  tintColor={colors.homeCardText}
                />
              </TwPressable>
            </TwPressable>
          ))
        )}
      </TwView>
    </ScrollScreenWrapper>
  );
}
