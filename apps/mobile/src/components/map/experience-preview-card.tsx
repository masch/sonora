import { useRouter } from 'expo-router';

import { worldDurationLabel, worldPriceLabel } from '@sonora/shared';

import { TRACK_IMAGES, DEFAULT_TRACK_IMAGE } from '@/constants/images';
import { ROUTES } from '@/constants/routes';
import type { PlayableExperience } from '@/data/experiences';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { TwImage, TwView } from '@/tw';

import { ThemedText } from '@/components/themed-text';
import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';

export interface ExperiencePreviewCardProps {
  /** The experience a tap selected, or null while nothing is selected. */
  experience: PlayableExperience | null;
  onDismiss: () => void;
}

/**
 * What a tapped point says before it opens.
 *
 * Not `ReferenceCard`: that card's only action is an external link behind a host
 * allowlist and it knows nothing about a price or a format, because it describes a
 * place on the map rather than something the app itself opens. This one describes
 * an experience the app owns, so its action is a route, and the card is the step
 * that turns a point into a destination.
 *
 * The badges are the map's own label helpers, so the card and the point never
 * disagree about how long an experience is or what it costs. A price is formatted
 * from minor units, and the cover comes from the bundled set the lists already
 * load, so opening this card costs no request.
 */
export default function ExperiencePreviewCard({
  experience,
  onDismiss,
}: ExperiencePreviewCardProps) {
  const { t } = useAppTranslation();
  const router = useRouter();

  const translate = (key: string, options?: Record<string, unknown>) =>
    t(key as TranslationKeys, options);
  const duration = experience ? worldDurationLabel(experience.durationSeconds, translate) : '';
  const price = experience ? worldPriceLabel(experience, translate) : '';

  function openExperience() {
    if (!experience) return;
    router.push(ROUTES.PATH.POETICS_DETAIL(experience.id, experience.title));
    onDismiss();
  }

  return (
    <BottomModal
      visible={experience !== null}
      onDismiss={onDismiss}
      title={experience?.title}
      showCloseButton
      closeButtonTestID="experience-preview-close"
    >
      {experience && (
        <TwView testID="experience-preview-card" className="gap-4">
          <TwImage
            testID="experience-preview-image"
            source={TRACK_IMAGES[experience.imageKey] ?? DEFAULT_TRACK_IMAGE}
            className="w-full h-40 rounded-xl"
            contentFit="cover"
            alt={experience.title}
          />

          <TwView className="flex-row flex-wrap items-center gap-2">
            <TwView
              testID="experience-preview-format"
              className="px-2.5 py-1 rounded-lg bg-zinc-200/40 dark:bg-zinc-800/60"
            >
              <ThemedText type="small" themeColor="textSecondary">
                {t(`experiences.types.${experience.format}` as TranslationKeys)}
              </ThemedText>
            </TwView>
            {duration !== '' && (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID="experience-preview-duration"
              >
                {duration}
              </ThemedText>
            )}
            {price !== '' && (
              <ThemedText type="small" themeColor="textSecondary" testID="experience-preview-price">
                {price}
              </ThemedText>
            )}
          </TwView>

          {experience.description !== '' && (
            <ThemedText type="small" themeColor="textSecondary">
              {experience.description}
            </ThemedText>
          )}

          <Button
            label={t('map.world.open')}
            accessibilityLabel={t('map.world.open')}
            testID="experience-preview-open"
            variant="primary"
            icon={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
            onPress={openExperience}
          />
        </TwView>
      )}
    </BottomModal>
  );
}
