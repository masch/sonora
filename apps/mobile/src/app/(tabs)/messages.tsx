import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import LoadingView from '@/components/loading-view';
import { TwView, TwPressable } from '@/tw';
import { SONORA_MESSAGES_BG } from '@/constants/images';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useLocationStore, type LocationStore } from '@/store/location-store';
import { useFeedbackQueue } from '@/hooks/use-feedback-queue';
import { useFeedbackSubmit } from '@/hooks/use-feedback-submit';
import { useFeedbackFeed } from '@/hooks/use-feedback-feed';
import FeedbackForm from '@/components/feedback-form';
import { getHaversineDistance } from '@/utils/haversine';
import { type Experience } from '@/data/experiences';
import { GENERAL_FEEDBACK_EXPERIENCE_ID } from '@sonora/shared';
import { getExperienceIcon } from '@/utils/icons';
import { TwAnimatedView } from '@/tw/animated';
import { FadeInUp } from 'react-native-reanimated';

interface FeedbackServerEntry {
  id: string;
  experienceId: string;
  message: string;
  createdAt: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface FeedbackDisplayEntry extends FeedbackServerEntry {
  isPending?: boolean;
}

/* ───────── Helper components ───────── */

const CARD_BG_COLOR_KEYS: Record<
  'general-feedback' | 'trip' | 'track',
  'homeLocalMessagesBg' | 'homeExploreRoutesBg' | 'homeExploreTracksBg'
> = {
  'general-feedback': 'homeLocalMessagesBg',
  trip: 'homeExploreRoutesBg',
  track: 'homeExploreTracksBg',
};

const proximityIcons = {
  all: {
    ios: 'globe' as SFSymbol,
    android: 'public' as AndroidSymbol,
    web: 'public' as AndroidSymbol,
  },
  nearby: {
    ios: 'location.fill' as SFSymbol,
    android: 'location_on' as AndroidSymbol,
    web: 'location_on' as AndroidSymbol,
  },
} as const;

const typeAllIcon = {
  ios: 'square.grid.2x2' as SFSymbol,
  android: 'grid_view' as AndroidSymbol,
  web: 'grid_view' as AndroidSymbol,
};
const typeGeneralIcon = getExperienceIcon('general-feedback');
const typeTripIcon = getExperienceIcon('trip');
const typeTrackIcon = getExperienceIcon('track');

interface FeedbackHeaderProps {
  onNewMessage: () => void;
}

function FeedbackHeader({ onNewMessage }: FeedbackHeaderProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  return (
    <TwView className="items-center py-4">
      <ThemedText className="text-xl font-bold tracking-widest text-text uppercase">
        {t('messages.title')}
      </ThemedText>
      <TwView className="mt-4">
        <TwPressable
          onPress={onNewMessage}
          accessibilityLabel={t('messages.newButton')}
          className="bg-text rounded-xl px-6 py-3 flex-row items-center gap-2 active:opacity-75"
          testID="new-message-button"
        >
          <Icon ios="plus" android="add" web="add" size={16} tintColor={colors.background} />
          <ThemedText themeColor="background" className="font-bold text-sm">
            {t('messages.newButton')}
          </ThemedText>
        </TwPressable>
      </TwView>
    </TwView>
  );
}

interface ProximityFilterProps {
  activeTab: 'todos' | 'cercanos';
  onSelect: (tab: 'todos' | 'cercanos') => void;
}

function ProximityFilter({ activeTab, onSelect }: ProximityFilterProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  return (
    <TwView className="flex-row items-center justify-between border-b border-zinc-300/10 dark:border-zinc-700/10 pb-3">
      <ThemedText className="text-[10px] font-black tracking-widest text-text uppercase">
        {t('messages.distanceLabel')}
      </ThemedText>
      <TwView className="flex-row gap-2">
        <FilterChip
          selected={activeTab === 'todos'}
          onPress={() => onSelect('todos')}
          icon={proximityIcons.all}
          tintColor={activeTab === 'todos' ? colors.background : colors.text}
          testID="tab-todos"
          accessibilityLabel={t('messages.filterTodos')}
          colors={colors}
        />
        <FilterChip
          selected={activeTab === 'cercanos'}
          onPress={() => onSelect('cercanos')}
          icon={proximityIcons.nearby}
          tintColor={activeTab === 'cercanos' ? colors.background : colors.text}
          testID="tab-cercanos"
          accessibilityLabel={t('messages.filterCercanos')}
          colors={colors}
        />
      </TwView>
    </TwView>
  );
}

interface TypeFilterProps {
  selectedType: 'all' | 'general-feedback' | 'trip' | 'track';
  onSelect: (type: 'all' | 'general-feedback' | 'trip' | 'track') => void;
}

function TypeFilter({ selectedType, onSelect }: TypeFilterProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  const types: {
    key: 'all' | 'general-feedback' | 'trip' | 'track';
    icon: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
    label: string;
  }[] = [
    { key: 'all', icon: typeAllIcon, label: t('experiences.categories.all') },
    { key: 'general-feedback', icon: typeGeneralIcon, label: t('messages.community') },
    { key: 'trip', icon: typeTripIcon, label: t('experiences.types.trip') },
    { key: 'track', icon: typeTrackIcon, label: t('experiences.types.track') },
  ];

  return (
    <TwView className="flex-row items-center justify-between">
      <ThemedText className="text-[10px] font-black tracking-widest text-text uppercase">
        {t('messages.categoryLabel')}
      </ThemedText>
      <TwView className="flex-row gap-2">
        {types.map((t) => (
          <FilterChip
            key={t.key}
            selected={selectedType === t.key}
            onPress={() => onSelect(t.key)}
            icon={t.icon}
            tintColor={selectedType === t.key ? colors.background : colors.text}
            testID={`type-filter-${t.key}`}
            accessibilityLabel={t.label}
            colors={colors}
          />
        ))}
      </TwView>
    </TwView>
  );
}

/* ───────── Shared filter chip ───────── */

interface FilterChipProps {
  selected: boolean;
  onPress: () => void;
  icon: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  tintColor: string;
  testID: string;
  accessibilityLabel: string;
  colors: ReturnType<typeof useThemeColors>;
}

function FilterChip({
  selected,
  onPress,
  icon,
  tintColor,
  testID,
  accessibilityLabel,
}: FilterChipProps) {
  return (
    <TwPressable
      onPress={onPress}
      className={`p-2 rounded-lg border ${
        selected
          ? 'bg-text border-text'
          : 'bg-zinc-200/50 dark:bg-zinc-800/50 border-zinc-300/40 dark:border-zinc-700/40'
      } active:opacity-75`}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <Icon ios={icon.ios} android={icon.android} web={icon.web} size={14} tintColor={tintColor} />
    </TwPressable>
  );
}

/* ───────── Filter controls card ───────── */

interface FilterControlsProps {
  activeTab: 'todos' | 'cercanos';
  selectedType: 'all' | 'general-feedback' | 'trip' | 'track';
  onTabChange: (tab: 'todos' | 'cercanos') => void;
  onTypeChange: (type: 'all' | 'general-feedback' | 'trip' | 'track') => void;
}

function FilterControls({
  activeTab,
  selectedType,
  onTabChange,
  onTypeChange,
}: FilterControlsProps) {
  return (
    <TwView className="card-container-solid rounded-3xl p-4 gap-4 mb-6 backdrop-blur-md">
      <ProximityFilter activeTab={activeTab} onSelect={onTabChange} />
      <TypeFilter selectedType={selectedType} onSelect={onTypeChange} />
    </TwView>
  );
}

/* ───────── Message card ───────── */

interface MessageCardProps {
  item: FeedbackDisplayEntry;
  experiences: Experience[];
  location: LocationStore;
  index: number;
}

function MessageCard({ item, experiences, location, index }: MessageCardProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  const exp = experiences.find((e) => e.id === item.experienceId);
  const isGeneral = item.experienceId === 'general-feedback';
  const title = isGeneral ? t('messages.community') : exp?.title || t('messages.community');
  const format = isGeneral ? 'general-feedback' : exp?.format || 'general-feedback';
  const iconConfig = getExperienceIcon(format);

  let distanceBadgeText = '';
  if (location.coords && item.latitude && item.longitude) {
    const dist = getHaversineDistance(
      location.coords.latitude,
      location.coords.longitude,
      item.latitude,
      item.longitude,
    );
    if (dist <= 50) {
      distanceBadgeText = t('messages.veryNear');
    } else if (dist <= 500) {
      distanceBadgeText = `${Math.round(dist)}m`;
    } else {
      distanceBadgeText = `${(dist / 1000).toFixed(1)}km`;
    }
  }

  return (
    <TwAnimatedView
      entering={FadeInUp.delay(index * 50).duration(300)}
      key={item.id}
      className="border border-zinc-300/10 dark:border-zinc-700/10 rounded-2xl p-5 gap-3"
      style={{ backgroundColor: colors[CARD_BG_COLOR_KEYS[format]] + 'CC' }}
      testID={`message-card-${item.id}`}
    >
      <TwView className="flex-row items-center justify-between pb-1">
        <TwView className="flex-row items-center gap-1.5 flex-1 pr-2">
          <Icon
            ios={iconConfig.ios}
            android={iconConfig.android}
            web={iconConfig.web}
            size={13}
            tintColor={colors.homeCardText}
          />
          <ThemedText
            className="text-xs font-semibold truncate flex-1"
            style={{ color: colors.homeCardText }}
          >
            {title}
          </ThemedText>
        </TwView>
        <ThemedText className="text-[10px]" style={{ color: colors.homeCardSubtext }}>
          {new Date(item.createdAt).toLocaleDateString()}
        </ThemedText>
      </TwView>

      <ThemedText
        className="text-base italic"
        style={{ color: colors.homeCardText }}
      >{`"${item.message}"`}</ThemedText>

      {(item.isPending || !!distanceBadgeText) && (
        <TwView className="flex-row gap-1.5 pt-1.5 border-t border-zinc-300/10 dark:border-zinc-700/10">
          {item.isPending && (
            <TwView className="bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex-row items-center gap-1">
              <Icon
                ios="icloud.and.arrow.up"
                android="cloud_queue"
                web="cloud_queue"
                size={10}
                tintColor="#f59e0b"
              />
              <ThemedText className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">
                {t('messages.pendingBadge')}
              </ThemedText>
            </TwView>
          )}
          {!!distanceBadgeText && (
            <TwView className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <ThemedText className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">
                {distanceBadgeText}
              </ThemedText>
            </TwView>
          )}
        </TwView>
      )}
    </TwAnimatedView>
  );
}

/* ───────── Main screen ───────── */

export default function MessagesScreen() {
  const { t } = useAppTranslation();
  const location = useLocationStore();
  const { queue } = useFeedbackQueue();
  const feedback = useFeedbackSubmit();

  const [activeTab, setActiveTab] = useState<'todos' | 'cercanos'>('todos');
  const [selectedType, setSelectedType] = useState<'all' | 'general-feedback' | 'trip' | 'track'>(
    'all',
  );
  const [modalVisible, setModalVisible] = useState(false);
  const { feed, experiences, loading, error, refetch } = useFeedbackFeed();

  useFocusEffect(() => {
    refetch();
  });

  // Refetch feed when background sync catches up
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('feedback-queue-synced', () => {
      refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const handleSubmit = (message: string) => {
    feedback.submitFeedback(GENERAL_FEEDBACK_EXPERIENCE_ID, message).then(() => {
      refetch();
    });
  };

  const mergedFeed: FeedbackDisplayEntry[] = [
    ...queue.map((entry) => ({
      id: entry.id,
      experienceId: entry.experienceId,
      message: entry.message,
      createdAt: entry.createdAt,
      latitude: entry.latitude,
      longitude: entry.longitude,
      isPending: true,
    })),
    ...feed.filter((serverEntry) => !queue.some((localEntry) => localEntry.id === serverEntry.id)),
  ];

  const displayedFeed = mergedFeed.filter((entry) => {
    if (activeTab === 'cercanos') {
      if (!location.coords || !entry.latitude || !entry.longitude) return false;
      const dist = getHaversineDistance(
        location.coords.latitude,
        location.coords.longitude,
        entry.latitude,
        entry.longitude,
      );
      if (dist > 500) return false;
    }

    if (selectedType !== 'all') {
      if (selectedType === 'general-feedback') return entry.experienceId === 'general-feedback';
      const exp = experiences.find((e) => e.id === entry.experienceId);
      return exp?.format === selectedType;
    }

    return true;
  });

  if (loading) {
    return <LoadingView message={t('messages.loading')} />;
  }

  if (error) {
    return (
      <TwView className="flex-grow items-center justify-center p-6 bg-background">
        <ThemedText className="text-base font-bold text-text mb-4 text-center">
          {t('messages.error')}
        </ThemedText>
        <TwPressable
          onPress={() => refetch()}
          className="px-6 py-2.5 bg-text rounded-xl active:opacity-75"
          testID="messages-retry-button"
          accessibilityLabel={t('messages.retry')}
        >
          <ThemedText themeColor="background" className="font-semibold">
            {t('messages.retry')}
          </ThemedText>
        </TwPressable>
      </TwView>
    );
  }

  return (
    <ScrollScreenWrapper
      disableBottomPadding
      backgroundImage={SONORA_MESSAGES_BG}
      contentContainerClassName="grow pb-8 px-6 pt-4"
    >
      <FeedbackHeader onNewMessage={() => setModalVisible(true)} />

      <FilterControls
        activeTab={activeTab}
        selectedType={selectedType}
        onTabChange={setActiveTab}
        onTypeChange={setSelectedType}
      />

      <TwView className="gap-4">
        {displayedFeed.length === 0 ? (
          <TwView className="items-center py-12" testID="messages-empty-state">
            <ThemedText className="text-textSecondary">{t('messages.emptyState')}</ThemedText>
          </TwView>
        ) : (
          displayedFeed.map((item, index) => (
            <MessageCard
              key={item.id}
              item={item}
              experiences={experiences}
              location={location}
              index={index}
            />
          ))
        )}
      </TwView>

      <FeedbackForm
        visible={modalVisible}
        status={feedback.feedbackStatus}
        errorMsg={feedback.feedbackError}
        onSubmit={handleSubmit}
        onDismiss={() => {
          feedback.dismissFeedback();
          setModalVisible(false);
        }}
      />
    </ScrollScreenWrapper>
  );
}
