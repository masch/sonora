import { ThemedText } from '@/components/themed-text';
import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';
import { useMapPrefetch } from '@/hooks/use-map-prefetch';
import { formatBytes } from '@/utils/format-bytes';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';

/**
 * The one question the startup map prefetch may ask.
 *
 * The prompt is driven by the app lifecycle, not by a button: the prefetch runs when
 * `/config` resolves, and this component is the surface that question lands on. It
 * renders nothing unless the prefetch decided to ask, so an accepted, already
 * downloaded or policy-forbidden set is invisible.
 *
 * What it says is deliberately the whole set at once: the walker approves the cost of
 * the download that will actually happen, not one region at a time. Dismissing is a
 * complete answer — nothing is downloaded, and every map keeps working when there is
 * a connection.
 */

export function MapDownloadPrompt() {
  const { prompt, accept, dismiss } = useMapPrefetch();
  const { t, language } = useAppTranslation();

  if (!prompt) return null;

  const regionCount = prompt.regions.length;
  const total = formatBytes(prompt.totalBytes, language);
  const body =
    regionCount === 1
      ? t('map.downloadPromptBodyOne', { count: regionCount, size: total })
      : t('map.downloadPromptBodyMany', { count: regionCount, size: total });

  return (
    <BottomModal
      visible
      onDismiss={dismiss}
      title={t('map.downloadPromptTitle')}
      closeButtonTestID="map-download-prompt-close"
      accessibilityLabel={t('map.downloadPromptTitle')}
      footer={
        <TwView className="gap-2">
          <Button
            onPress={accept}
            label={t('map.downloadPromptAccept')}
            accessibilityLabel={t('map.downloadPromptAccept')}
            testID="map-download-prompt-accept"
          />
          <Button
            onPress={dismiss}
            label={t('map.downloadPromptDismiss')}
            accessibilityLabel={t('map.downloadPromptDismiss')}
            testID="map-download-prompt-dismiss"
            variant="ghost"
          />
        </TwView>
      }
    >
      <TwView className="gap-3" testID="map-download-prompt">
        <ThemedText type="small" themeColor="textSecondary">
          {body}
        </ThemedText>
        <TwView className="gap-1">
          {prompt.regions.map((region) => (
            <ThemedText
              key={region.key}
              type="smallBold"
              testID={`map-download-prompt-region-${region.key}`}
            >
              {region.label}
            </ThemedText>
          ))}
        </TwView>
      </TwView>
    </BottomModal>
  );
}
