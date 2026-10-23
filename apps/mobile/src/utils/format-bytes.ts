import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@sonora/shared';

/** One size unit, largest first, and the decimal unit each one counts in. */
const BYTE_UNITS = [
  { scale: 1e9, suffix: 'GB' },
  { scale: 1e6, suffix: 'MB' },
  { scale: 1e3, suffix: 'KB' },
] as const;

/** Separator the reader's language uses between the units and the decimals. */
function decimalSeparator(language: SupportedLanguage): string {
  return language === 'es' ? ',' : '.';
}

/**
 * A byte count as a reader reads it: `826 KB`, `1,6 MB`, `8 MB`.
 *
 * Decimal units (1000-based), because the number comes from a `Content-Length` and
 * the ceiling it is compared against is decimal too. One decimal, and only when the
 * size is not a whole number of units — `8 MB` says more than `8,0 MB`. The separator
 * follows the reader's language, since `1,6` and `1.6` are the same number written
 * for two different readers.
 */
export function formatBytes(bytes: number, language: SupportedLanguage = DEFAULT_LANGUAGE): string {
  const size = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;

  let index = BYTE_UNITS.findIndex((unit) => size >= unit.scale);
  if (index === -1) return `${Math.round(size)} B`;

  let unit = BYTE_UNITS[index];
  let value = Math.round((size / unit.scale) * 10) / 10;

  // Rounding can push a value onto the next unit (`999 999` bytes is `1 MB`, not
  // `1000 KB`), so the unit follows the number it ended up with.
  while (value >= 1000 && index > 0) {
    index -= 1;
    unit = BYTE_UNITS[index];
    value = Math.round((size / unit.scale) * 10) / 10;
  }

  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text.replace('.', decimalSeparator(language))} ${unit.suffix}`;
}
