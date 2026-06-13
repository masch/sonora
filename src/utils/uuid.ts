/**
 * Generates a unique identifier (UUID) safely.
 *
 * Uses the Web Cryptography API if available (e.g. on web or modern environments),
 * and falls back to a timestamp + random base36 string generator in environments
 * where `crypto` is not defined (e.g. React Native Hermes engine).
 */
export function generateUUID(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
