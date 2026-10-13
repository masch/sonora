import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { useAppTranslation } from '@/hooks/use-translation';
import { formatDistance } from '@/utils/format-distance';

interface GeofenceBlockedModalProps {
  visible: boolean;
  onDismiss: () => void;
  requiredRadiusMeters: number;
  distanceMeters: number | null;
}

export function GeofenceBlockedModal({
  visible,
  onDismiss,
  requiredRadiusMeters,
  distanceMeters,
}: GeofenceBlockedModalProps) {
  const { t } = useAppTranslation();

  return (
    <BottomModal
      visible={visible}
      onDismiss={onDismiss}
      title={t('experiences.geofenceBlocked.blockedAlertTitle')}
      footer={
        <Button
          label={t('experiences.geofenceBlocked.blockedAlertOk')}
          variant="primary"
          testID="geofence-blocked-alert-ok"
          accessibilityLabel={t('experiences.geofenceBlocked.blockedAlertOk')}
          onPress={onDismiss}
        />
      }
    >
      <ThemedText className="text-sm text-textSecondary">
        {t('experiences.geofenceBlocked.blockedAlertMessage', {
          radius: formatDistance(requiredRadiusMeters, t),
          distance: formatDistance(
            distanceMeters,
            t,
            t('experiences.geofenceBlocked.notAvailable'),
          ),
        })}
      </ThemedText>
    </BottomModal>
  );
}
