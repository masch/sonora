import { useState, useCallback } from 'react';
import { useAppTranslation } from '@/hooks/use-translation';
import { useConfirm } from '@/hooks/use-confirm';
import { useRemoteConfigStore } from '@/store/remote-config-store';

interface UseGeofencePlaybackGuardProps {
  isNearStart: boolean;
  isBypassable: boolean;
}

export function useGeofencePlaybackGuard({
  isNearStart,
  isBypassable,
}: UseGeofencePlaybackGuardProps) {
  const { t } = useAppTranslation();
  const { confirm, component: confirmComponent } = useConfirm();
  const [showGeofenceBlockedAlert, setShowGeofenceBlockedAlert] = useState(false);

  const bypassGeofence = useRemoteConfigStore((s) => s.config.geofence.bypassGeofence);
  const isPlaybackBlocked = !isNearStart && !isBypassable && !bypassGeofence;
  const showBypassWarning = !isNearStart && isBypassable && !bypassGeofence;

  const guardAction = useCallback(
    async (action: () => void) => {
      if (showBypassWarning) {
        const ok = await confirm({
          title: t('experiences.warnings.locationAlertTitle'),
          message: t('experiences.warnings.locationAlertMessage'),
          confirmLabel: t('experiences.warnings.continue'),
          cancelLabel: t('experiences.warnings.cancel'),
        });
        if (!ok) return;
      } else if (isPlaybackBlocked) {
        setShowGeofenceBlockedAlert(true);
        return;
      }
      action();
    },
    [confirm, isPlaybackBlocked, showBypassWarning, t],
  );

  return {
    isPlaybackBlocked,
    showGeofenceBlockedAlert,
    setShowGeofenceBlockedAlert,
    confirmComponent,
    guardAction,
  };
}
