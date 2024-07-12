import type { TranslationKeys } from '@/i18n/types';

/**
 * Format a distance in meters for display, with optional null fallback.
 *
 * @example formatDistance(1500, t)           → "1.5 km"
 * @example formatDistance(null, t, 'N/A')     → "N/A"
 */
export function formatDistance(
  meters: number | null,
  t: (key: TranslationKeys, params?: Record<string, unknown>) => string,
  fallbackText?: string,
): string {
  if (meters === null) return fallbackText ?? '';
  if (meters >= 1000) {
    return t('map.distanceKilometers', { value: (meters / 1000).toFixed(1) });
  }
  return t('map.distanceMeters', { value: Math.round(meters) });
}
