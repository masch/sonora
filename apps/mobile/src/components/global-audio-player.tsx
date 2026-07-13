import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments, usePathname } from 'expo-router';
import { useAudioPlayerStore } from '@/store/audio-player-store';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAudioRewind } from '@/hooks/use-audio-rewind';
import { useCurrentExperience } from '@/hooks/use-current-experience';
import { TwView, TwPressable, TwText } from '@/tw';
import { Icon } from '@/components/icon';
import { TAB_BAR_INSET } from '@/components/screen-wrapper';

export function GlobalAudioPlayer() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const handleRewind = useAudioRewind();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { experienceId, isPlaying, isPaused, metadata: currentMetadata } = useCurrentExperience();

  const positionMs = useAudioPlayerStore((s) => s.positionMs);
  const durationMs = useAudioPlayerStore((s) => s.durationMs);
  const currentUri = useAudioPlayerStore((s) => s.currentUri);
  const play = useAudioPlayerStore((s) => s.play);
  const pause = useAudioPlayerStore((s) => s.pause);
  const stop = useAudioPlayerStore((s) => s.stop);

  // Extract route track/trip ID from pathname globally (useful since useLocalSearchParams is undefined in root _layout)
  const pathParts = pathname.split('/');
  const routeIdParam = pathParts[1] === 'tracks' ? pathParts[2] : undefined;

  // Normalize route param ID to match clean experience ID formats
  const cleanSegmentId = routeIdParam?.replace(/^(track|trip)-/, '');

  // Hide the global audio player if the local audio player is already visible:
  // 1. Playing instructions on the Home tab screen
  // 2. Viewing the track details page of the currently playing track
  const isLocalControllerVisible =
    (experienceId === 'instructions' &&
      segments[0] === '(tabs)' &&
      (segments[1] === undefined || (segments[1] as string) === 'index')) ||
    (segments[0] === 'tracks' &&
      cleanSegmentId !== undefined &&
      (experienceId === cleanSegmentId ||
        currentMetadata?.id === cleanSegmentId ||
        currentMetadata?.slug === cleanSegmentId));

  const isVisible = (isPlaying || isPaused) && currentUri !== null && !isLocalControllerVisible;

  if (!isVisible) {
    return null;
  }

  // Calculate progress percentage
  const progressPct = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else if (currentUri) {
      play(currentUri);
    }
  };

  const handleClose = () => {
    stop();
  };

  // Determine bottom offset: above bottom tabs when inside tab navigator, near bottom (safe area offset) otherwise
  const isInTabs = segments[0] === '(tabs)';
  const bottomOffset = isInTabs
    ? Platform.OS === 'android'
      ? TAB_BAR_INSET + 12
      : TAB_BAR_INSET
    : Platform.OS === 'android'
      ? Math.max(insets.bottom, 16)
      : Math.max(insets.bottom, 12);

  return (
    <TwView
      testID="global-audio-player"
      className="absolute left-0 right-0 border-b"
      style={{
        bottom: bottomOffset,
        backgroundColor: colors.tabBarBg,
        borderBottomColor: colors.border,
      }}
    >
      {/* Mini Progress Bar */}
      <TwView className="h-[2px] bg-zinc-400/20 w-full">
        <TwView
          testID="global-player-progress-bar-fill"
          className="h-full bg-cyan-500"
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </TwView>

      {/* Controls Container */}
      <TwView className="flex-row items-center justify-between px-4 py-2.5">
        {/* Close Button */}
        <TwPressable
          onPress={handleClose}
          accessibilityLabel={t('common.dismiss')}
          testID="global-player-close-button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="active:opacity-60"
        >
          <Icon
            ios="xmark"
            android="close"
            web="close"
            size={18}
            tintColor={colors.tabBarIconActive}
          />
        </TwPressable>

        {/* Title */}
        <TwView className="flex-1 mx-4">
          <TwText
            numberOfLines={1}
            className="text-sm font-bold text-center"
            style={{ color: colors.tabBarIconActive }}
            testID="global-player-title"
          >
            {currentMetadata?.title || t('home.instructionsName')}
          </TwText>
        </TwView>

        {/* Action Buttons (Rewind + Play/Pause) */}
        <TwView className="flex-row items-center">
          {/* Rewind Button */}
          <TwPressable
            onPress={handleRewind}
            accessibilityLabel={t('components.mediaControls.btnRewind')}
            testID="global-player-rewind-button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="active:opacity-60 mr-4"
          >
            <Icon name="rewind" size={20} tintColor={colors.tabBarIconActive} />
          </TwPressable>

          {/* Play/Pause Button */}
          <TwPressable
            onPress={handlePlayPause}
            accessibilityLabel={
              isPlaying
                ? t('components.mediaControls.btnPause')
                : t('components.mediaControls.btnPlay')
            }
            testID="global-player-play-pause-button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="active:opacity-60"
          >
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              tintColor={colors.tabBarIconActive}
            />
          </TwPressable>
        </TwView>
      </TwView>
    </TwView>
  );
}
