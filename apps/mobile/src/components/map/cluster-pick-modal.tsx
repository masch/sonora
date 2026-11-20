import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { BottomModal } from '@/components/ui/bottom-modal';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwScrollView, TwView } from '@/tw';

import type { WorldExperience } from '@sonora/shared';

/**
 * The places a cluster or a shared place holds, one button each.
 *
 * Membership is decided by the caller: the modal receives the exact slugs to list,
 * so it never re-decides what "the same place" means — the crowd rule lives in
 * `worldPlaceGroups` and the pressed cluster's members in the press path. The slugs
 * are resolved against the payload, not the map source: the map is a projection of
 * the lists, and the picker is the same projection a zoom would have answered with.
 */
export interface ClusterPickModalProps {
  /**
   * The picker's own list, as the slugs it holds, or `null` while it is closed.
   *
   * A slug the payload does not carry is skipped, so a stale press can never name
   * an experience that no longer exists.
   */
  slugs: readonly string[] | null;
  /** Every published experience, unfiltered: the picker is a place, not a format. */
  experiences: readonly WorldExperience[];
  /** Names the experience the walker chose, and closes the picker. */
  onPick: (slug: string) => void;
  /** Closes the picker without choosing. */
  onDismiss: () => void;
}

export function ClusterPickModal({ slugs, experiences, onPick, onDismiss }: ClusterPickModalProps) {
  const { t } = useAppTranslation();

  const held =
    slugs === null
      ? []
      : slugs
          .map((slug) => experiences.find((experience) => experience.slug === slug))
          .filter((experience): experience is WorldExperience => experience !== undefined);

  return (
    <BottomModal
      visible={slugs !== null}
      onDismiss={onDismiss}
      title={t('map.world.clusterTitle')}
      accessibilityLabel={t('map.world.clusterTitle')}
      showCloseButton
      closeButtonTestID="world-cluster-pick-close"
    >
      <TwView className="gap-3">
        <ThemedText type="small" themeColor="textSecondary">
          {t('map.world.clusterShared')}
        </ThemedText>
        <TwScrollView
          // A crowd of any size has to stay fully reachable: the title and the
          // dismiss stay outside this region, and the scroll bounds the list so
          // thirty options still fit a phone's viewport.
          className="max-h-80"
          testID="world-cluster-pick-scroll"
        >
          <TwView className="gap-2">
            {held.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('map.world.empty')}
              </ThemedText>
            ) : (
              held.map((experience) => (
                <Button
                  key={experience.slug}
                  label={experience.title}
                  accessibilityLabel={experience.title}
                  testID={`world-cluster-pick-${experience.slug}`}
                  variant="outline"
                  size="sm"
                  onPress={() => onPick(experience.slug)}
                />
              ))
            )}
          </TwView>
        </TwScrollView>
      </TwView>
    </BottomModal>
  );
}
