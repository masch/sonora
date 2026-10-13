import { Button, IconButton } from '@/components/ui/button';
import { TAB_BAR_INSET } from '@/components/screen-wrapper';
import { ROUTES } from '@/constants/routes';
import { useAudioRewind } from '@/hooks/use-audio-rewind';
import { isSameExperience, useCurrentExperience } from '@/hooks/use-current-experience';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';
import { useAudioPlayerStore } from '@/store/audio-player-store';
import { TwView } from '@/tw';
import { INSTRUCTIONS_EXPERIENCE_ID, INSTRUCTIONS_EXPERIENCES_SLUG } from '@sonora/shared';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getGlobalPlayerBottomOffset(
  segments: string[],
  pathname: string,
  bottomInset: number,
): number {
  const firstSegment = segments[0] ? segments[0].replace(/^\//, '') : 'index';
  const tabRoutes = ['index', 'explore', 'settings', 'derivas', 'messages'];
  const isInTabs =
    firstSegment === '(tabs)' || pathname === '/' || tabRoutes.includes(firstSegment);

  if (isInTabs) {
    if (Platform.OS === 'android') return TAB_BAR_INSET + 12;
    if (Platform.OS === 'web') return 56;
    return TAB_BAR_INSET;
  }
  return Platform.OS === 'android' ? Math.max(bottomInset, 16) : Math.max(bottomInset, 12);
}

function navigateToCurrentExperience(
  router: ReturnType<typeof useRouter>,
  experienceId?: string | null,
  slug?: string | null,
  id?: string | null,
  title?: string | null,
) {
  const targetId = experienceId || slug || id;
  if (targetId === INSTRUCTIONS_EXPERIENCES_SLUG || targetId === INSTRUCTIONS_EXPERIENCE_ID) {
    router.push(ROUTES.PATH.DERIVAS);
  } else if (targetId) {
    router.push(ROUTES.PATH.POETICS_DETAIL(targetId, title || undefined));
  }
}

function GlobalPlayerProgressBar({ progressPct }: { progressPct: number }) {
  const clamped = Math.min(100, Math.max(0, progressPct));
  return (
    <TwView className="h-[2px] bg-zinc-400/20 w-full">
      <TwView
        testID="global-player-progress-bar-fill"
        className="h-full bg-cyan-500"
        style={{ width: `${clamped}%` }}
      />
    </TwView>
  );
}

interface GlobalPlayerControlsProps {
  isPlaying: boolean;
  title: string;
  tabBarIconActiveColor: string;
  onClose: () => void;
  onTitlePress: () => void;
  onRewind: () => void;
  onPlayPause: () => void;
}

function GlobalPlayerControls({
  isPlaying,
  title,
  tabBarIconActiveColor: _tabBarIconActiveColor,
  onClose,
  onTitlePress,
  onRewind,
  onPlayPause,
}: GlobalPlayerControlsProps) {
  const { t } = useAppTranslation();

  return (
    <TwView className="flex-row items-center justify-between px-4 py-2.5">
      {/* Close Button */}
      <IconButton
        onPress={onClose}
        accessibilityLabel={t('common.dismiss')}
        testID="global-player-close-button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        variant="ghost"
        size="sm"
        icon={{ ios: 'xmark', android: 'close', web: 'close' }}
      />

      {/* Title */}
      <TwView className="flex-1 mx-2">
        <Button
          label={title}
          variant="ghost"
          size="sm"
          onPress={onTitlePress}
          accessibilityLabel={title}
          testID="global-player-title-button"
          numberOfLines={1}
          className="px-2 py-1 justify-center"
        />
      </TwView>

      {/* Action Buttons (Rewind + Play/Pause) */}
      <TwView className="flex-row items-center">
        {/* Rewind Button */}
        <IconButton
          onPress={onRewind}
          accessibilityLabel={t('components.mediaControls.btnRewind')}
          testID="global-player-rewind-button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          variant="ghost"
          size="sm"
          iconName="rewind"
          className="mr-2"
        />

        {/* Play/Pause Button */}
        <IconButton
          onPress={onPlayPause}
          accessibilityLabel={
            isPlaying
              ? t('components.mediaControls.btnPause')
              : t('components.mediaControls.btnPlay')
          }
          testID="global-player-play-pause-button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          variant="ghost"
          size="sm"
          iconName={isPlaying ? 'pause' : 'play'}
        />
      </TwView>
    </TwView>
  );
}

export function GlobalAudioPlayer() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const handleRewind = useAudioRewind();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentExperience = useCurrentExperience();
  const { isPlaying, isPaused, metadata: currentMetadata, experienceId } = currentExperience;

  const positionMs = useAudioPlayerStore((s) => s.positionMs);
  const durationMs = useAudioPlayerStore((s) => s.durationMs);
  const currentUri = useAudioPlayerStore((s) => s.currentUri);
  const play = useAudioPlayerStore((s) => s.play);
  const pause = useAudioPlayerStore((s) => s.pause);
  const stop = useAudioPlayerStore((s) => s.stop);

  // Extract route track/trip ID from pathname globally
  const pathParts = pathname.split('/');
  const routeIdParam = pathParts[1] === ROUTES.POETICS ? pathParts[2] : undefined;
  const isDetailView = isSameExperience(currentExperience, routeIdParam);

  const isVisible = (isPlaying || isPaused) && currentUri !== null && !isDetailView;

  if (!isVisible) {
    return null;
  }

  const progressPct = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const bottomOffset = getGlobalPlayerBottomOffset(segments, pathname, insets.bottom);
  const displayTitle = currentMetadata?.title || t('home.instructionsName');

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else if (currentUri) {
      play(currentUri);
    }
  };

  const handleTitlePress = () => {
    navigateToCurrentExperience(
      router,
      experienceId,
      currentMetadata?.slug,
      currentMetadata?.id,
      currentMetadata?.title,
    );
  };

  return (
    <TwView
      testID="global-audio-player"
      className="absolute left-0 right-0 border-b z-40"
      style={{
        bottom: bottomOffset,
        backgroundColor: colors.tabBarBg,
        borderBottomColor: colors.border,
      }}
    >
      <GlobalPlayerProgressBar progressPct={progressPct} />
      <GlobalPlayerControls
        isPlaying={isPlaying}
        title={displayTitle}
        tabBarIconActiveColor={colors.tabBarIconActive}
        onClose={stop}
        onTitlePress={handleTitlePress}
        onRewind={handleRewind}
        onPlayPause={handlePlayPause}
      />
    </TwView>
  );
}
