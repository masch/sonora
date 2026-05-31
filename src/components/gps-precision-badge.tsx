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
    ? 'from-amber-500 to-orange-600'
    : isReady
      ? 'bg-emerald-400/20 border-emerald-500/30'
      : 'bg-zinc-700/50';

  const statusTextClass = isWeak
    ? 'text-amber-300'
    : isReady
      ? 'text-emerald-400'
      : 'text-zinc-400';

  return (
    <TwView
      testID="gps-precision-badge"
      className={`bg-backgroundElement gap-4 self-stretch p-4 rounded-[24px] border ${
        isReady ? 'border-emerald-500/20' : isWeak ? 'border-amber-500/20' : 'border-zinc-700'
      }`}
    >
      {/* Status pill */}
      <TwView className="flex-row items-center gap-2">
        <TwView className={`flex-1 rounded-xl overflow-hidden ${isWeak ? '' : ''}`}>
          <TwView className={`py-2 px-4 items-center ${statusClass} ${isWeak ? '' : 'rounded-xl'}`}>
            <TwText className={`text-sm font-bold ${statusTextClass}`}>
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
            {gpsAccuracy !== null ? `${gpsAccuracy.toFixed(1)}m` : 'N/A'}
          </ThemedText>
        }
      />
      <HintRow
        title={t('components.gpsBadge.distance')}
        hint={
          <ThemedText type="code">
            {distanceMeters !== null ? `${distanceMeters.toFixed(1)}m` : 'N/A'}
          </ThemedText>
        }
      />
      <HintRow
        title={t('index.geofence.requiredProximity')}
        hint={<ThemedText type="code">{`${requiredRadiusMeters}m`}</ThemedText>}
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
