import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwText, TwView } from '@/tw';
import { useThemeColors } from '@/hooks/use-theme-colors';

interface GeofenceBlockedBannerProps {
  distanceMeters: number | null;
  requiredRadiusMeters: number;
}

function formatDistance(distanceMeters: number | null, fallbackText: string): string {
  if (distanceMeters === null) return fallbackText;
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(distanceMeters)} m`;
}

export default function GeofenceBlockedBanner({
  distanceMeters,
  requiredRadiusMeters,
}: GeofenceBlockedBannerProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  return (
    <TwView
      testID="geofence-blocked-banner"
      className="card-container gap-4 self-stretch p-4 rounded-[24px]"
      style={{ borderColor: colors.border }}
    >
      {/* Header row: icon + title */}
      <TwView className="flex-row items-center gap-3">
        <TwView className="bg-rose-100 dark:bg-rose-950/40 p-2.5 rounded-full">
          <Icon
            ios="location.fill"
            android="location_on"
            web="location_on"
            size={22}
            tintColor="#e11d48"
          />
        </TwView>
        <TwView className="flex-1">
          <TwText className="text-rose-700 dark:text-rose-300 font-black text-sm">
            {t('experiences.geofenceBlocked.bannerTitle')}
          </TwText>
        </TwView>
      </TwView>

      {/* Description */}
      <ThemedText type="small" themeColor="textSecondary">
        {t('experiences.geofenceBlocked.bannerDescription', {
          radius: requiredRadiusMeters,
        })}
      </ThemedText>

      {/* Distance info */}
      <TwView className="bg-rose-50 dark:bg-rose-950/30 rounded-xl px-4 py-3">
        <TwText className="text-rose-800 dark:text-rose-200 text-xs font-bold">
          {t('experiences.geofenceBlocked.bannerDistance', {
            distance: formatDistance(distanceMeters, t('experiences.geofenceBlocked.notAvailable')),
          })}
        </TwText>
      </TwView>
    </TwView>
  );
}
