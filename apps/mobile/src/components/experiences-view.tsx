import { HomeAudioPlayer } from '@/components/home-audio-player';
import { Icon } from '@/components/icon';
import LoadingView from '@/components/loading-view';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import {
  DEFAULT_TRACK_IMAGE,
  SONORA_TRACKS_BG,
  SONORA_TRIP_BG,
  TRACK_IMAGES,
} from '@/constants/images';
import { ROUTES } from '@/constants/routes';
import { CARD_BG_COLOR_KEYS } from '@/constants/theme';
import type { Experience, ExperienceFormat, Theme } from '@/data/experiences';
import { fetchExperiences, fetchThemes, USER_EXPERIENCE_FORMATS } from '@/data/experiences';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';
import type { TranslationKeys } from '@/i18n/types';
import { TwPressable, TwScrollView, TwTextInput, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { logger } from '@/utils/logger';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

async function fetchDynamicData() {
  const [fetchedThemes, fetchedExps] = await Promise.all([fetchThemes(), fetchExperiences()]);
  return { themes: fetchedThemes, experiences: fetchedExps };
}

export default function ExperiencesScreen({
  format,
  showChips = false,
}: {
  format?: ExperienceFormat;
  showChips?: boolean;
}) {
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
  const isMountedRef = useRef(true);

  const loadData = () => {
    setLoading(true);
    setError(false);
    fetchDynamicData()
      .then((data) => {
        if (!isMountedRef.current) return;
        setThemesList(data.themes);
        setExperiences(data.experiences);
        setError(false);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMountedRef.current) return;
        logger.error('Failed to load dynamic data:', err);
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    isMountedRef.current = true;

    void Promise.resolve().then(() => {
      if (isMountedRef.current) {
        loadData();
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (loading) {
    return (
      <ScrollScreenWrapper disableBottomPadding>
        <LoadingView message={t('experiences.loading')} />
      </ScrollScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScrollScreenWrapper disableBottomPadding contentContainerClassName="grow">
        <TwView className="flex-grow items-center justify-center p-6">
          <ThemedText className="text-base font-bold text-text mb-4 text-center">
            {t('experiences.errorLoading')}
          </ThemedText>

          <Button
            onPress={() => loadData()}
            label={t('experiences.retry')}
            accessibilityLabel={t('experiences.retry')}
            testID="experiences-retry-button"
            variant="primary"
          />
        </TwView>
      </ScrollScreenWrapper>
    );
  }

  return (
    <ExperiencesContent
      key={lockedFormat}
      experiences={experiences}
      themesList={themesList}
      isFormatLocked={isFormatLocked}
      initialFormat={initialFormat}
      showChips={showChips}
    />
  );
}

function ExperiencesContent({
  experiences,
  themesList,
  isFormatLocked,
  initialFormat,
  showChips,
}: {
  experiences: Experience[];
  themesList: Theme[];
  isFormatLocked: boolean;
  initialFormat: ExperienceFormat;
  showChips: boolean;
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
      contentContainerClassName="grow pb-8 pt-4"
    >
      <TwView className="px-1">
        <TwView className="items-center py-4">
          <ThemedText className="text-xl font-bold tracking-widest text-text uppercase">
            {t(`experiences.types.${selectedFormat}` as TranslationKeys)}
          </ThemedText>
        </TwView>

        {!isFormatLocked && showChips && (
          <TwView className="flex-row gap-2 mb-4 justify-center">
            {USER_EXPERIENCE_FORMATS.map((format) => {
              const translationKey = `experiences.types.${format}` as TranslationKeys;
              return (
                <Chip
                  key={format}
                  label={t(translationKey)}
                  selected={selectedFormat === format}
                  // The format also scopes the theme row below it, so a new format
                  // starts from the unfiltered list rather than a stale theme.
                  onPress={() => {
                    setSelectedFormat(format);
                    setSelectedTheme('all');
                  }}
                  testID={`type-chip-${format}`}
                  accessibilityLabel={t(translationKey)}
                  labelClassName="capitalize"
                />
              );
            })}
          </TwView>
        )}

        <TwView className="flex-row items-center gap-2 mb-4">
          <TwView className="flex-1 flex-row items-center bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-300/30 dark:border-zinc-700/30 rounded-xl px-3.5 py-2.5">
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
      </TwView>

      {showChips && (
        <TwView className="mb-5">
          <TwScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-6 gap-2.5 flex-row items-center py-1"
          >
            {themeOptions.map((theme) => {
              const isSelected = selectedTheme === theme.key;
              return (
                <Chip
                  key={theme.key}
                  onPress={() => setSelectedTheme(theme.key)}
                  label={t(theme.labelKey)}
                  selected={isSelected}
                  shape="pill"
                  accessibilityLabel={t(theme.labelKey)}
                  testID={`category-chip-${theme.key}`}
                />
              );
            })}
          </TwScrollView>
        </TwView>
      )}

      <TwView className="px-1 gap-5">
        {/* Instructions Audio Player */}
        {selectedFormat === 'trip' && <HomeAudioPlayer />}

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
            </TwPressable>
          ))
        )}
      </TwView>
    </ScrollScreenWrapper>
  );
}
