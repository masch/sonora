import type { TranslationKeys } from '@/i18n/types';

/**
 * Format a distance in meters for display, with adaptive precision:
 * - < 1 000 m: rounded meters (e.g. "350 m")
 * - 1 000 m - 9 999 m: 1 decimal place (e.g. "1.5 km", "8.2 km")
 * - >= 10 000 m: whole kilometers with thousands separator (e.g. "45 km", "9,761 km")
 *
 * @example formatDistance(500, t)            → "500 m"
 * @example formatDistance(1500, t)           → "1.5 km"
 * @example formatDistance(12500, t)          → "13 km"
 * @example formatDistance(9761400, t)        → "9,761 km"
 * @example formatDistance(null, t, 'N/A')     → "N/A"
 */
const numberFormatter = new Intl.NumberFormat();

export function formatDistance(
  meters: number | null,
  t: (key: TranslationKeys, params?: Record<string, unknown>) => string,
  fallbackText?: string,
): string {
  if (meters === null || isNaN(meters)) return fallbackText ?? '';
  if (meters < 1000) {
    return t('map.distanceMeters', { value: Math.round(meters) });
  }
  const km = meters / 1000;
  if (km < 10) {
    return t('map.distanceKilometers', { value: km.toFixed(1) });
  }
  return t('map.distanceKilometers', {
    value: numberFormatter.format(Math.round(km)),
  });
}
