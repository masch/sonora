import { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import LoadingView from '@/components/loading-view';
import { TwView, TwPressable } from '@/tw';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useLocationStore } from '@/store/location-store';
import { APP_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';
import { useFeedbackQueue } from '@/hooks/use-feedback-queue';
import FeedbackForm from '@/components/feedback-form';
import { getHaversineDistance } from '@/utils/haversine';
import { type Experience } from '@/data/experiences';
import { getExperienceIcon } from '@/utils/icons';
import { TwAnimatedView } from '@/tw/animated';
import { FadeInUp } from 'react-native-reanimated';
import { generateUUID } from '@/utils/uuid';

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

export default function MessagesScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const location = useLocationStore();
  const { enqueue, queue } = useFeedbackQueue();

  // Filter icon definitions
  const proximityAllIcon = {
    ios: 'globe' as SFSymbol,
    android: 'public' as AndroidSymbol,
    web: 'public' as AndroidSymbol,
  };
  const proximityNearbyIcon = {
    ios: 'location.fill' as SFSymbol,
    android: 'location_on' as AndroidSymbol,
    web: 'location_on' as AndroidSymbol,
  };
  const typeAllIcon = {
    ios: 'square.grid.2x2' as SFSymbol,
    android: 'grid_view' as AndroidSymbol,
    web: 'grid_view' as AndroidSymbol,
  };
  const typeGeneralIcon = getExperienceIcon('general-feedback');
  const typeTripIcon = getExperienceIcon('trip');
  const typeTrackIcon = getExperienceIcon('track');

  const [activeTab, setActiveTab] = useState<'todos' | 'cercanos'>('todos');
  const [selectedType, setSelectedType] = useState<'all' | 'general-feedback' | 'trip' | 'track'>(
    'all',
  );
  const [feed, setFeed] = useState<FeedbackServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Manual submission form state
  const [modalVisible, setModalVisible] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    'sending' | 'sent' | 'queued' | 'error' | undefined
  >(undefined);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);

  const fetchFeed = (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    return Promise.all([
      fetch(`${APP_CONFIG.apiBaseUrl}/feedback`, { signal: controller.signal }),
      fetch(`${APP_CONFIG.apiBaseUrl}/experiences`, { signal: controller.signal }),
    ])
      .then(async ([feedResponse, expResponse]) => {
        clearTimeout(timeoutId);
        if (!feedResponse.ok || !expResponse.ok) throw new Error('API failed');
        const [feedData, expData] = await Promise.all([feedResponse.json(), expResponse.json()]);
        setFeed(feedData);
        setExperiences(expData);
        setError(false);
      })
      .catch((err: unknown) => {
        clearTimeout(timeoutId);
        logger.error('Failed to fetch feedback feed:', err);
        setError(true);
      })
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    Promise.all([
      fetch(`${APP_CONFIG.apiBaseUrl}/feedback`, { signal: controller.signal }),
      fetch(`${APP_CONFIG.apiBaseUrl}/experiences`, { signal: controller.signal }),
    ])
      .then(async ([feedResponse, expResponse]) => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (!feedResponse.ok || !expResponse.ok) throw new Error('API failed');
        const [feedData, expData] = await Promise.all([feedResponse.json(), expResponse.json()]);
        setFeed(feedData);
        setExperiences(expData);
        setError(false);
      })
      .catch((fetchErr) => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        logger.error('Failed to fetch feedback feed:', fetchErr);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('feedback-queue-synced', () => {
      fetchFeed(true);
    });
    return () => sub.remove();
  }, []);

  const handleManualSubmit = async (message: string) => {
    setSubmitStatus('sending');
    setSubmitErrorMsg(null);
    const lat = location.coords?.latitude ?? null;
    const lng = location.coords?.longitude ?? null;

    const payload = {
      experienceId: APP_CONFIG.feedback.generalExperienceId,
      message,
      latitude: lat,
      longitude: lng,
    };

    const idempotencyKey = generateUUID();

    try {
      // Attempt standard online dispatch
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          idempotencyKey,
          createdAt: new Date().toISOString(),
        }),
      });

      if (response.status === 201) {
        setSubmitStatus('sent');
        fetchFeed(true);
      } else {
        // Enqueue offline if server error or connection issues
        await enqueue(payload, idempotencyKey);
        setSubmitStatus('queued');
      }
    } catch {
      // Network failure triggers offline storage queueing
      await enqueue(payload, idempotencyKey);
      setSubmitStatus('queued');
    }
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

  // Filter feed client-side based on distance and type
  const displayedFeed = mergedFeed.filter((entry) => {
    // 1. Proximity filter
    if (activeTab === 'cercanos') {
      if (!location.coords || !entry.latitude || !entry.longitude) return false;
      const dist = getHaversineDistance(
        location.coords.latitude,
        location.coords.longitude,
        entry.latitude,
        entry.longitude,
      );
      if (dist > 500) return false; // Only feedback created within 500 meters range
    }

    // 2. Type/Format filter
    if (selectedType !== 'all') {
      if (selectedType === 'general-feedback') {
        return entry.experienceId === 'general-feedback';
      }
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
          onPress={() => fetchFeed()}
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
      contentContainerClassName="grow pb-8 bg-background px-6 pt-4"
    >
      {/* Centered Header Title */}
      <TwView className="items-center py-4">
        <ThemedText className="text-xl font-bold tracking-widest text-text uppercase">
          {t('messages.title')}
        </ThemedText>
      </TwView>

      {/* Manual Trigger Button */}
      <TwView className="mb-4 items-center">
        <TwPressable
          onPress={() => {
            setSubmitStatus(undefined);
            setModalVisible(true);
          }}
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

      {/* Filter Control Card (Unified Glassmorphism) */}
      <TwView className="bg-zinc-200/10 dark:bg-zinc-800/10 border border-zinc-300/10 dark:border-zinc-700/10 rounded-3xl p-4 gap-4 mb-6 backdrop-blur-md">
        {/* Proximity Filter */}
        <TwView className="flex-row items-center justify-between border-b border-zinc-300/10 dark:border-zinc-700/10 pb-3">
          <ThemedText className="text-[10px] font-black tracking-widest text-textSecondary uppercase">
            {t('messages.distanceLabel')}
          </ThemedText>
          <TwView className="flex-row gap-2">
            <TwPressable
              onPress={() => setActiveTab('todos')}
              className={`p-2 rounded-lg border ${
                activeTab === 'todos'
                  ? 'bg-text border-text'
                  : 'bg-zinc-200/5 dark:bg-zinc-800/5 border-zinc-300/20 dark:border-zinc-700/20'
              } active:opacity-75`}
              testID="tab-todos"
              accessibilityLabel={t('messages.filterTodos')}
            >
              <Icon
                ios={proximityAllIcon.ios}
                android={proximityAllIcon.android}
                web={proximityAllIcon.web}
                size={14}
                tintColor={activeTab === 'todos' ? colors.background : colors.text}
              />
            </TwPressable>
            <TwPressable
              onPress={() => setActiveTab('cercanos')}
              className={`p-2 rounded-lg border ${
                activeTab === 'cercanos'
                  ? 'bg-text border-text'
                  : 'bg-zinc-200/5 dark:bg-zinc-800/5 border-zinc-300/20 dark:border-zinc-700/20'
              } active:opacity-75`}
              testID="tab-cercanos"
              accessibilityLabel={t('messages.filterCercanos')}
            >
              <Icon
                ios={proximityNearbyIcon.ios}
                android={proximityNearbyIcon.android}
                web={proximityNearbyIcon.web}
                size={14}
                tintColor={activeTab === 'cercanos' ? colors.background : colors.text}
              />
            </TwPressable>
          </TwView>
        </TwView>

        {/* Type/Format Filter */}
        <TwView className="flex-row items-center justify-between">
          <ThemedText className="text-[10px] font-black tracking-widest text-textSecondary uppercase">
            {t('messages.categoryLabel')}
          </ThemedText>
          <TwView className="flex-row gap-2">
            <TwPressable
              onPress={() => setSelectedType('all')}
              className={`p-2 rounded-lg border ${
                selectedType === 'all'
                  ? 'bg-text border-text'
                  : 'bg-zinc-200/5 dark:bg-zinc-800/5 border-zinc-300/20 dark:border-zinc-700/20'
              } active:opacity-75`}
              testID="type-filter-all"
              accessibilityLabel={t('experiences.categories.all')}
            >
              <Icon
                ios={typeAllIcon.ios}
                android={typeAllIcon.android}
                web={typeAllIcon.web}
                size={14}
                tintColor={selectedType === 'all' ? colors.background : colors.text}
              />
            </TwPressable>
            <TwPressable
              onPress={() => setSelectedType('general-feedback')}
              className={`p-2 rounded-lg border ${
                selectedType === 'general-feedback'
                  ? 'bg-text border-text'
                  : 'bg-zinc-200/5 dark:bg-zinc-800/5 border-zinc-300/20 dark:border-zinc-700/20'
              } active:opacity-75`}
              testID="type-filter-general"
              accessibilityLabel={t('messages.community')}
            >
              <Icon
                ios={typeGeneralIcon.ios}
                android={typeGeneralIcon.android}
                web={typeGeneralIcon.web}
                size={14}
                tintColor={selectedType === 'general-feedback' ? colors.background : colors.text}
              />
            </TwPressable>
            <TwPressable
              onPress={() => setSelectedType('trip')}
              className={`p-2 rounded-lg border ${
                selectedType === 'trip'
                  ? 'bg-text border-text'
                  : 'bg-zinc-200/5 dark:bg-zinc-800/5 border-zinc-300/20 dark:border-zinc-700/20'
              } active:opacity-75`}
              testID="type-filter-trip"
              accessibilityLabel={t('experiences.types.trip')}
            >
              <Icon
                ios={typeTripIcon.ios}
                android={typeTripIcon.android}
                web={typeTripIcon.web}
                size={14}
                tintColor={selectedType === 'trip' ? colors.background : colors.text}
              />
            </TwPressable>
            <TwPressable
              onPress={() => setSelectedType('track')}
              className={`p-2 rounded-lg border ${
                selectedType === 'track'
                  ? 'bg-text border-text'
                  : 'bg-zinc-200/5 dark:bg-zinc-800/5 border-zinc-300/20 dark:border-zinc-700/20'
              } active:opacity-75`}
              testID="type-filter-track"
              accessibilityLabel={t('experiences.types.track')}
            >
              <Icon
                ios={typeTrackIcon.ios}
                android={typeTrackIcon.android}
                web={typeTrackIcon.web}
                size={14}
                tintColor={selectedType === 'track' ? colors.background : colors.text}
              />
            </TwPressable>
          </TwView>
        </TwView>
      </TwView>

      {/* Feed List */}
      <TwView className="gap-4">
        {displayedFeed.length === 0 ? (
          <TwView className="items-center py-12" testID="messages-empty-state">
            <ThemedText className="text-textSecondary">{t('messages.emptyState')}</ThemedText>
          </TwView>
        ) : (
          displayedFeed.map((item, index) => {
            const exp = experiences.find((e) => e.id === item.experienceId);
            const isGeneral = item.experienceId === 'general-feedback';
            const title = isGeneral
              ? t('messages.community')
              : exp?.title || t('messages.community');

            // Resolve icon based on experience type/format
            const format = isGeneral ? 'general-feedback' : exp?.format || 'general-feedback';
            const iconConfig = getExperienceIcon(format);

            // Resolve distance badge
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
                className="bg-zinc-200/20 dark:bg-zinc-800/20 border border-zinc-300/20 dark:border-zinc-700/20 rounded-2xl p-5 gap-3"
                testID={`message-card-${item.id}`}
              >
                {/* Card Header: Category & Date */}
                <TwView className="flex-row items-center justify-between pb-1">
                  <TwView className="flex-row items-center gap-1.5 flex-1 pr-2">
                    <Icon
                      ios={iconConfig.ios}
                      android={iconConfig.android}
                      web={iconConfig.web}
                      size={13}
                      tintColor={colors.textSecondary}
                    />
                    <ThemedText className="text-xs text-textSecondary font-semibold truncate flex-1">
                      {title}
                    </ThemedText>
                  </TwView>
                  <ThemedText className="text-[10px] text-textSecondary">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </ThemedText>
                </TwView>

                {/* Message text body */}
                <ThemedText className="text-base text-text italic">
                  {`"${item.message}"`}
                </ThemedText>

                {/* Card Footer: Status and Proximity Badges */}
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
          })
        )}
      </TwView>

      {/* Submission modal */}
      <FeedbackForm
        visible={modalVisible}
        status={submitStatus}
        errorMsg={submitErrorMsg}
        onSubmit={handleManualSubmit}
        onDismiss={() => setModalVisible(false)}
      />
    </ScrollScreenWrapper>
  );
}
