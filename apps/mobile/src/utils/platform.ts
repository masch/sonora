import { Platform } from 'react-native';

/**
 * Returns true if the app is running inside an iOS/iPadOS web browser (Safari, Chrome on iOS, etc.).
 * Returns false on native iOS/Android, Android Web, and Desktop Web.
 */
export function isIosBrowser(): boolean {
  if (Platform.OS !== 'web') {
    return false;
  }
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  const isIosDevice = /iPad|iPhone|iPod/i.test(ua);
  // iPadOS 13+ desktop-class browsing reports "Macintosh" in userAgent, but has touch points
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIosDevice || isIpadOs;
}
