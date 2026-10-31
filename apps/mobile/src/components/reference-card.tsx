import { MAP_LINK_ALLOWED_HOSTS, isAllowedHttpsUrl } from '@sonora/shared';
import { Linking } from 'react-native';

import type { MapReferencePress } from '@/components/map/map-view.types';
import { ThemedText } from '@/components/themed-text';
import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';
import {
  useAppTranslation,
  type AppTFunction,
  type TranslationKeys,
} from '@/hooks/use-translation';
import { TwImage, TwView } from '@/tw';
import { logger } from '@/utils/logger';

export interface ReferenceCardProps {
  /** The reference the map reported, or null while nothing is tapped. */
  reference: MapReferencePress | null;
  onDismiss: () => void;
}

/**
 * Title for the card: the text the map already resolved, otherwise the translation
 * of the key that text came from. A missing translation renders the key itself, so a
 * keyed reference never loses its title.
 */
function referenceTitle(reference: MapReferencePress | null, t: AppTFunction): string | undefined {
  if (!reference) return undefined;
  return (
    reference.labelText ??
    (reference.labelKey ? t(reference.labelKey as TranslationKeys) : undefined)
  );
}

/**
 * Content card for a tapped map reference.
 *
 * Labels and descriptions arrive as i18n keys, so the text follows the app
 * language; a key with no translation renders the key itself instead of an
 * empty card. The action leaves the app, so the URL is checked here as well as
 * on write: only an https URL on an allowlisted host gets the button, and a link
 * that fails that check is not card content either, so a reference whose only
 * payload is such a link opens no card at all.
 */
export default function ReferenceCard({ reference, onDismiss }: ReferenceCardProps) {
  const { t } = useAppTranslation();

  const title = referenceTitle(reference, t);
  // A self-contained reference carries no key: its description was resolved from the
  // document, and it is card content just like a keyed one.
  const description =
    reference?.descriptionText ??
    (reference?.descriptionKey ? t(reference.descriptionKey as TranslationKeys) : undefined);
  const linkUrl = reference?.linkUrl;
  const canOpenLink = Boolean(linkUrl && isAllowedHttpsUrl(linkUrl, MAP_LINK_ALLOWED_HOSTS));

  // A tap on a drawn feature is not a reference: the derived itinerary carries a
  // label and nothing else (D8), so a label alone must not open an empty card.
  // An unopenable link cannot fill that card, so `canOpenLink` — not the raw
  // `linkUrl` — is what counts as link content.
  const hasCardContent = Boolean(description || reference?.imageUrl || canOpenLink);

  /**
   * Sends the walker to the reference's external page.
   *
   * The URL already passed the https + allowlist check that renders the button,
   * so this only guards the empty case; a rejected scheme makes `openURL` throw,
   * which is logged instead of failing the screen.
   */
  function openLink() {
    if (!linkUrl) return;
    Linking.openURL(linkUrl).catch((err: unknown) => {
      logger.warn('ReferenceCard could not open the reference link:', err);
    });
  }

  return (
    <BottomModal visible={hasCardContent} onDismiss={onDismiss} title={title} showCloseButton>
      <TwView testID="reference-card" className="gap-4">
        {reference?.imageUrl && (
          <TwImage
            testID="reference-card-image"
            source={{ uri: reference.imageUrl }}
            className="w-full h-40 rounded-xl"
            contentFit="cover"
            alt={title ?? ''}
          />
        )}

        {description && (
          <ThemedText testID="reference-card-description" className="text-sm text-textSecondary">
            {description}
          </ThemedText>
        )}

        {canOpenLink && linkUrl && (
          <Button
            label={t('map.openLink')}
            variant="primary"
            testID="reference-card-link"
            accessibilityLabel={t('map.openLink')}
            icon={{ ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' }}
            onPress={openLink}
          />
        )}
      </TwView>
    </BottomModal>
  );
}
