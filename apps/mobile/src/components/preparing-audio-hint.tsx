import { ThemedText } from '@/components/themed-text';
import { useAppTranslation } from '@/hooks/use-translation';
import type { TranslationKeys } from '@/i18n/types';

/**
 * Hint shown while the parent re-fetches an experience after a purchase so the
 * signed audioUrl becomes available. Shared by the trip and track detail views.
 */
export default function PreparingAudioHint() {
  const { t } = useAppTranslation();

  return (
    <ThemedText
      className="text-center text-xs font-semibold"
      themeColor="textSecondary"
      testID="preparing-audio-hint"
    >
      {t('experiences.geofenceBlocked.preparingAudio' as TranslationKeys)}
    </ThemedText>
  );
}
