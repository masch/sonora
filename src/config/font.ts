/**
 * Font configuration — single source of truth for the app font.
 *
 * To change the font in the future:
 * 1. Update the values below
 * 2. Sync `cssFamily` in `global.css` (`--font-sans`)
 * 3. Sync the npm package in `package.json`
 */

export const fontConfig = {
  /** Font family name (used in CSS and native config plugin) */
  family: 'Caveat',

  /** Font weights to load */
  weights: [400, 500, 600, 700] as const,

  /** CSS `font-family` fallback chain (keep in sync with `global.css` `--font-sans`) */
  cssFamily:
    'Caveat, Inter, ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji',

  /** Google Fonts CDN URL for web */
  googleFontsUrl:
    'https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap',

  /** Native font file paths (relative to project root, for expo-font config plugin) */
  nativeFonts: [
    'node_modules/@expo-google-fonts/caveat/400Regular/Caveat_400Regular.ttf',
    'node_modules/@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf',
    'node_modules/@expo-google-fonts/caveat/600SemiBold/Caveat_600SemiBold.ttf',
    'node_modules/@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf',
  ],

  /** Optional: npm package for Expo Go / font loading */
  npmPackage: '@expo-google-fonts/caveat',
} as const;

export type FontWeight = (typeof fontConfig.weights)[number];
