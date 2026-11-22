import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { TwView } from '@/tw';

import { browserCapability, MAP_REQUIRED_IOS_VERSION } from './browser-capability';
import type { MapLoadErrorCode } from './map-view.types';

/** The sentence each code becomes on screen; the words live here, not in the hooks. */
const ERROR_MESSAGE_KEYS: Record<MapLoadErrorCode, TranslationKeys> = {
  archiveMissing: 'map.errors.archiveMissing',
  archiveDownloadFailed: 'map.errors.archiveUnavailable',
  styleRequestFailed: 'map.errors.styleUnavailable',
  styleInvalid: 'map.errors.styleUnavailable',
  mapFailed: 'map.errors.mapUnavailable',
  unsupported: 'map.errors.unsupported',
};

export interface MapErrorViewProps {
  code: MapLoadErrorCode;
  onRetry: () => void;
  testID?: string;
  className?: string;
}

/**
 * The one failure surface a map renders.
 *
 * Shared by the renderers because a map that cannot draw fails the same way on both:
 * a title, the sentence its code resolves to, and a retry. It lives outside them
 * because that is the whole reason it can be written once — the platform detail (which
 * wait stalled, what the request said) stays in the renderer's log, never on screen.
 */
export default function MapErrorView({
  code,
  onRetry,
  testID = 'experience-map',
  className = 'h-80 w-full',
}: MapErrorViewProps) {
  const { t } = useAppTranslation();

  // The device verdict is the one failure retry cannot address: updating the OS is
  // the fix, and until it happens every press would repeat the same failure. The
  // sentence names both versions so the walker knows the gap without asking.
  const isUnsupported = code === 'unsupported';
  const capability = isUnsupported ? browserCapability() : null;

  return (
    <TwView
      testID={`${testID}-error`}
      className={`${className} items-center justify-center gap-2 bg-backgroundElement px-4`}
    >
      <ThemedText>{t('map.offlineTitle')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" className="text-center">
        {/* The sentence is ours and it is translated here, so no English text from a
            request or from the renderer reaches the screen. */}
        {isUnsupported
          ? t(ERROR_MESSAGE_KEYS[code], {
              required: `iOS ${MAP_REQUIRED_IOS_VERSION}`,
              current: capability?.osVersion ?? '',
            })
          : t(ERROR_MESSAGE_KEYS[code])}
      </ThemedText>
      {isUnsupported ? null : (
        <Button
          label={t('common.retry')}
          accessibilityLabel={t('common.retry')}
          testID="experience-map-retry"
          variant="primary"
          size="sm"
          onPress={onRetry}
        />
      )}
    </TwView>
  );
}
