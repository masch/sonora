/**
 * Format a price stored in minor units (cents) for display.
 *
 * Prices are stored as integers in the DB (cents, e.g. 15000 = $150.00).
 * This utility converts to major units and formats with the correct locale.
 *
 * @example formatPrice(15000, 'ARS') → "ARS 150,00"
 * @example formatPrice(500, 'ARS')   → "ARS 5,00"
 */
export function formatPrice(
  cents: number,
  currency = 'ARS',
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const fractionDigits = options?.minimumFractionDigits ?? options?.maximumFractionDigits ?? 2;

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits ?? fractionDigits,
  }).format(cents / 100);
}
