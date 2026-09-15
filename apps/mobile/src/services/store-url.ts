import * as Application from 'expo-application';
import { Platform } from 'react-native';

export interface StoreUrls {
  primary: string;
  fallback?: string;
}

const DEFAULT_ANDROID_PACKAGE = 'org.sonoraderivapoeticas.app';
const DEFAULT_WEB_URL = 'https://sonoraderivapoeticas-team-sonora.expo.app/';

/**
 * Resolves platform-specific store URLs for update redirection.
 * Supports custom appId override (e.g. for testing or explicit store IDs).
 */
export function getStoreUrls(appIdOverride?: string): StoreUrls {
  const appId = appIdOverride || Application.applicationId || DEFAULT_ANDROID_PACKAGE;

  if (Platform.OS === 'android') {
    return {
      primary: `market://details?id=${appId}`,
      fallback: `https://play.google.com/store/apps/details?id=${appId}`,
    };
  }

  if (Platform.OS === 'ios') {
    return {
      primary: `itms-apps://apps.apple.com/app/id${appId}`,
      fallback: `https://apps.apple.com/app/id${appId}`,
    };
  }

  return {
    primary: DEFAULT_WEB_URL,
  };
}

/**
 * Returns direct Google Play Store web URL for Android redirection.
 */
export function getPlayStoreUrl(appIdOverride?: string): string {
  const appId = appIdOverride || Application.applicationId || DEFAULT_ANDROID_PACKAGE;
  return `https://play.google.com/store/apps/details?id=${appId}`;
}
