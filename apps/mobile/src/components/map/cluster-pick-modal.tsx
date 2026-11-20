import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { BottomModal } from '@/components/ui/bottom-modal';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';

import type { WorldExperience } from '@sonora/shared';

/**
 * The places a cluster that cannot expand holds, one button each.
 *
 * A cluster that cannot expand any further — two experiences published on the same
 * GPS point — has no zoom to answer a tap with, so the places it holds are listed
 * instead. They are read from the payload, not the source: the map is a projection
 * of the lists, and the picker is the same projection a zoom would have answered
 * with.
 */
export interface ClusterPickModalProps {
  /** The cluster a tap landed on, or `null` while the picker is closed. */
  cluster: { longitude: number; latitude: number } | null;
  /** Every published experience, unfiltered: the cluster is a place, not a format. */
  experiences: readonly WorldExperience[];
  /** Names the experience the walker chose, and closes the picker. */
  onPick: (slug: string) => void;
  /** Closes the picker without choosing. */
  onDismiss: () => void;
}

/** The span a cluster's centre matches a published place, in degrees (~10 m). */
const CLUSTER_MATCH_DEGREES = 1e-4;

export function ClusterPickModal({
  cluster,
  experiences,
  onPick,
  onDismiss,
}: ClusterPickModalProps) {
  const { t } = useAppTranslation();

  const held =
    cluster === null
      ? []
      : experiences.filter(
          (experience) =>
            Math.abs(experience.latitude - cluster.latitude) < CLUSTER_MATCH_DEGREES &&
            Math.abs(experience.longitude - cluster.longitude) < CLUSTER_MATCH_DEGREES,
        );

  return (
    <BottomModal
      visible={cluster !== null}
      onDismiss={onDismiss}
      title={t('map.world.clusterTitle')}
      showCloseButton
      closeButtonTestID="world-cluster-pick-close"
    >
      <TwView className="gap-3">
        <ThemedText type="small" themeColor="textSecondary">
          {t('map.world.clusterShared')}
        </ThemedText>
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
      </TwView>
    </BottomModal>
  );
}
