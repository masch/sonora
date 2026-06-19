import { useState } from 'react';
import { FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { TwView, TwTextInput, TwPressable } from '@/tw';
import { TwImage } from '@/tw/image';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { getAllTracks } from '@/data/tracks';
import type { TranslationKeys } from '@/i18n/types';

const TRACK_IMAGES = {
  'deriva-centro': require('@/assets/images/sonora/deriva-centro.png'),
  'bonus-track': require('@/assets/images/sonora/bonus-track.png'),
  'tacuarita-azul': require('@/assets/images/sonora/deriva-centro.png'),
  'el-arroyo': require('@/assets/images/sonora/fondo-recorridos-sec-1.png'),
  'la-piedra-antigua': require('@/assets/images/sonora/banner-fondo-logo-1.png'),
  'viento-chanares': require('@/assets/images/sonora/deriva-centro.png'),
  'voces-monte': require('@/assets/images/sonora/bonus-track.png'),
};

type CategoryKey = 'all' | 'birds' | 'stories' | 'landscapes' | 'poems' | 'community' | 'children';

const CATEGORIES: { key: CategoryKey; labelKey: TranslationKeys }[] = [
  { key: 'all', labelKey: 'tracks.categories.all' },
  { key: 'birds', labelKey: 'tracks.categories.birds' },
  { key: 'stories', labelKey: 'tracks.categories.stories' },
  { key: 'landscapes', labelKey: 'tracks.categories.landscapes' },
  { key: 'poems', labelKey: 'tracks.categories.poems' },
  { key: 'community', labelKey: 'tracks.categories.community' },
  { key: 'children', labelKey: 'tracks.categories.children' },
];

export default function TracksScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');

  // Filtering Logic
  const filteredTracks = (() => {
    const tracksList = getAllTracks();
    return tracksList.filter((track) => {
      const matchesCategory = selectedCategory === 'all' || track.category === selectedCategory;
      const matchesSearch =
        track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.subLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  })();

  return (
    <ScrollScreenWrapper
      disableBottomPadding
      contentContainerClassName="grow pb-8 bg-background px-6 pt-4"
    >
      {/* Centered Header */}
      <TwView className="items-center py-4">
        <ThemedText className="text-xl font-bold tracking-widest text-text uppercase">
          {t('tracks.title')}
        </ThemedText>
      </TwView>

      {/* Search Input and Filter Icon */}
      <TwView className="flex-row items-center gap-2 mb-4">
        {/* Search bar container */}
        <TwView className="flex-1 flex-row items-center bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-300/30 dark:border-zinc-700/30 rounded-xl px-3 py-2.5">
          <Icon
            ios="magnifyingglass"
            android="search"
            web="search"
            size={18}
            tintColor={colors.textSecondary}
          />
          <TwTextInput
            placeholder={t('tracks.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-sm font-medium text-text ml-2 pb-0"
            accessibilityLabel={t('tracks.searchPlaceholder')}
            testID="tracks-search-input"
          />
        </TwView>

        {/* Filter settings button */}
        <TwPressable
          className="p-3 bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-300/30 dark:border-zinc-700/30 rounded-xl active:opacity-75"
          accessibilityLabel={t('tracks.filterSettings')}
          testID="tracks-filter-settings-button"
        >
          <Icon
            ios="slider.horizontal.3"
            android="tune"
            web="tune"
            size={18}
            tintColor={colors.text}
          />
        </TwPressable>
      </TwView>

      {/* Category Selection Chips Carousel */}
      <TwView className="mb-6 -mx-6">
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-6 gap-2"
          keyExtractor={(item) => item.key}
          renderItem={({ item: cat }) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <TwPressable
                onPress={() => setSelectedCategory(cat.key)}
                className={`px-4 py-2 rounded-full border ${
                  isSelected
                    ? 'bg-text border-text'
                    : 'bg-zinc-200/10 dark:bg-zinc-800/10 border-zinc-300/40 dark:border-zinc-700/40'
                } active:opacity-75`}
                accessibilityLabel={t(cat.labelKey)}
                testID={`category-chip-${cat.key}`}
              >
                <ThemedText
                  themeColor={isSelected ? 'background' : 'text'}
                  className="text-xs font-semibold"
                >
                  {t(cat.labelKey)}
                </ThemedText>
              </TwPressable>
            );
          }}
        />
      </TwView>

      {/* Track List */}
      <TwView className="gap-5">
        {filteredTracks.length === 0 ? (
          <TwView className="items-center py-12" testID="tracks-empty-state">
            <ThemedText className="text-textSecondary" accessibilityLabel={t('tracks.notFound')}>
              {t('tracks.notFound')}
            </ThemedText>
          </TwView>
        ) : (
          filteredTracks.map((track) => (
            <TwPressable
              key={track.id}
              onPress={() => router.push(`/tracks/${track.id}`)}
              className="flex-row items-center gap-4 active:opacity-75"
              testID={`track-row-${track.id}`}
              accessibilityLabel={t('tracks.rowAccessibilityLabel', {
                title: track.title,
                subLabel: track.subLabel,
                duration: Math.round(track.durationSeconds / 60),
                minAbbr: t('tracks.minAbbr'),
              })}
            >
              {/* Thumbnail */}
              <TwImage
                source={TRACK_IMAGES[track.imageKey]}
                className="size-16 rounded-xl bg-zinc-200 dark:bg-zinc-800"
                contentFit="cover"
                alt=""
              />

              {/* Info stack */}
              <TwView className="flex-1 justify-center">
                <ThemedText className="text-sm font-bold text-text leading-tight mb-0.5">
                  {track.title}
                </ThemedText>
                <ThemedText className="text-xs text-textSecondary leading-normal mb-0.5">
                  {track.subLabel}
                </ThemedText>
                <ThemedText className="text-xs text-textSecondary font-semibold leading-none">
                  {Math.round(track.durationSeconds / 60)} {t('tracks.minAbbr')}
                </ThemedText>
              </TwView>

              {/* Options button */}
              <TwPressable
                className="p-2 active:opacity-70"
                accessibilityLabel={t('tracks.actionsMenu')}
                testID={`track-actions-${track.id}`}
              >
                <Icon
                  ios="ellipsis"
                  android="more_vert"
                  web="more_vert"
                  size={20}
                  tintColor={colors.text}
                />
              </TwPressable>
            </TwPressable>
          ))
        )}
      </TwView>
    </ScrollScreenWrapper>
  );
}
