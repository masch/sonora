import type { SupportedLanguage } from '@sonora/shared';

/**
 * `NSLocationWhenInUseUsageDescription` copy, per declared language.
 *
 * iOS reads a usage description out of `Info.plist` before any JavaScript runs, so this
 * sentence cannot be fetched from i18next the way an in-app string is. It lives with the
 * translations all the same, keyed by the same language codes the app declares, so the
 * copy has one home and `app.config.ts` only forwards it: the local
 * `with-localized-location-permission` plugin writes one `InfoPlist.strings` per language,
 * and the unlocalized `Info.plist` value is the fallback below.
 *
 * The type keeps this list honest: a language added to `SUPPORTED_LANGUAGES` without copy
 * fails `tsc` here instead of shipping an untranslated permission prompt.
 */
export const LOCATION_USAGE_COPY: Record<SupportedLanguage, string> = {
  en: 'Sonora uses your location to show you where you are on the map and to know when you are at an experience.',
  es: 'Sonora usa tu ubicación para mostrarte dónde estás en el mapa y saber cuándo estás en una experiencia.',
};

/**
 * The value written into the unlocalized `Info.plist`, which iOS shows when the device
 * language is none of the declared ones. It is the sentence of the app's default
 * language (`DEFAULT_LANGUAGE` in `@sonora/shared`), referenced rather than retyped so
 * there is still one sentence to edit.
 *
 * `DEFAULT_LANGUAGE` is restated by name only: `app.config.ts` is evaluated by Expo
 * before the app's modules load, and importing the shared barrel there would drag its
 * extensionless module graph into the config load.
 */
export const LOCATION_USAGE_FALLBACK = LOCATION_USAGE_COPY.es;
