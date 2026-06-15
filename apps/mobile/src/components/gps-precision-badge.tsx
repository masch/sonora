import { ThemedText } from '@/components/themed-text';
import { HintRow } from '@/components/hint-row';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwText, TwView } from '@/tw';

export type GpsStatus = 'initializing' | 'weak' | 'ready';

interface GpsPrecisionBadgeProps {
  gpsStatus: GpsStatus;
  gpsAccuracy: number | null;
  distanceMeters: number | null;
  isNearStart: boolean;
  requiredRadiusMeters: number;
}

export default function GpsPrecisionBadge({
  gpsStatus,
  gpsAccuracy,
  distanceMeters,
  isNearStart,
  requiredRadiusMeters,
}: GpsPrecisionBadgeProps) {
  const { t } = useAppTranslation();

  const isWeak = gpsStatus === 'weak';
  const isReady = gpsStatus === 'ready';

  const statusClass = isWeak
    ? 'bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30'
    : isReady
      ? 'bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/30'
      : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50';

  const statusTextClass = isWeak
    ? 'text-amber-800 dark:text-amber-300'
    : isReady
      ? 'text-emerald-800 dark:text-emerald-300'
      : 'text-zinc-600 dark:text-zinc-400';

  return (
    <TwView
      testID="gps-precision-badge"
      className="card-container gap-4 self-stretch p-4 rounded-[24px]"
    >
      {/* Status pill */}
      <TwView className="flex-row items-center gap-2">
        <TwView className="flex-1 rounded-xl overflow-hidden">
          <TwView className={`py-2 px-4 items-center rounded-xl ${statusClass}`}>
            <TwText className={`text-sm font-black text-center ${statusTextClass}`}>
              {gpsStatus === 'initializing' && t('components.gpsBadge.statusInitializing')}
              {isWeak && t('components.gpsBadge.statusWeak')}
              {isReady && t('components.gpsBadge.statusReady')}
            </TwText>
          </TwView>
        </TwView>
      </TwView>

      {/* Accuracy and distance info */}
      <HintRow
        title={t('components.gpsBadge.accuracy')}
        hint={
          <ThemedText type="code">
            {gpsAccuracy !== null
              ? t('map.distanceMeters', { value: gpsAccuracy.toFixed(1) })
              : t('index.geofence.notAvailable')}
          </ThemedText>
        }
      />
      <HintRow
        title={t('components.gpsBadge.distance')}
        hint={
          <ThemedText type="code">
            {distanceMeters !== null
              ? distanceMeters >= 1000
                ? t('map.distanceKilometers', { value: (distanceMeters / 1000).toFixed(1) })
                : t('map.distanceMeters', { value: Math.round(distanceMeters) })
              : t('index.geofence.notAvailable')}
          </ThemedText>
        }
      />
      <HintRow
        title={t('index.geofence.requiredProximity')}
        hint={
          <ThemedText type="code">
            {t('map.distanceMeters', { value: requiredRadiusMeters })}
          </ThemedText>
        }
      />
      <HintRow
        title={t('index.geofence.nearStartLocation')}
        hint={
          <ThemedText type="code" className={isNearStart ? 'text-emerald-400' : 'text-rose-400'}>
            {isNearStart ? t('components.gpsBadge.nearStart') : t('index.geofence.no')}
          </ThemedText>
        }
      />
    </TwView>
  );
}
