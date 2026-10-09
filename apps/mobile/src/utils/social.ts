import { Linking, Platform } from 'react-native';
import { logger } from '@/utils/logger';

/**
 * Strips leading '@' if present and trims whitespace.
 *
 * @param handle - Raw Instagram handle or username.
 * @returns Clean username without leading '@'.
 */
export function sanitizeInstagramHandle(handle: string): string {
  return handle.trim().replace(/^@/, '');
}

/**
 * Attempts to open Instagram profile in the native app,
 * falling back to the web browser if the native app is unavailable.
 * Catches any opening errors to prevent unhandled promise rejections.
 *
 * @param handle - Raw or formatted Instagram handle.
 */
export async function openInstagramProfile(handle: string): Promise<void> {
  const username = sanitizeInstagramHandle(handle);
  if (!username) return;

  const encodedUsername = encodeURIComponent(username);

  // On native mobile (iOS/Android), attempt deep link first
  if (Platform.OS !== 'web') {
    try {
      await Linking.openURL(`instagram://user?username=${encodedUsername}`);
      return;
    } catch {
      // Fallback to web URL below if app is not installed
    }
  }

  const webUrl = `https://instagram.com/${encodedUsername}`;
  try {
    // Web platform or native fallback
    await Linking.openURL(webUrl);
  } catch (error) {
    logger.warn('[Social] Failed to open Instagram profile', { username, error });
  }
}
