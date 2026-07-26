# Exploration: splash-version

## Splash Flow (3 phases)

1. **Native splash**: `splash-icon.png` with background `#208AEF` (prod) / `#F59E0B` (staging)
2. **Font loading**: `_layout.tsx` returns `null` while Caveat loads
3. **AnimatedSplashOverlay**: custom Reanimated component, 600ms (blue rect only, no version text)

## Version Source

- `app.config.ts` has `version: '1.0.0'` hardcoded and `versionCode: process.env.APP_VERSION_CODE || 6`
- CI generates tags `prod-v1.0.X` / `stg-v1.0.X` from `package.json` version
- `APP_VERSION_CODE` is calculated as tag count
- Runtime: `expo-application.nativeApplicationVersion` reads actual version from binary
- `expo-application` already installed as dependency

## Tech Stack

- Expo SDK 56, Expo Router, NativeWind v5, Reanimated
- `TwText` / `ThemedText` for themed text
- i18n in `packages/shared/src/locales/{en,es}.ts`
- Caveat font (loaded before overlay)

## Key Components

- `AnimatedSplashOverlay` — best place for version text, needs duration extension and dynamic styling
- `StagingBadge` — similar absolute badge pattern

## Current Overlay

- Blue rectangle with scale/opacity animation
- No version text, no env awareness (staging vs prod color)
- Duration: 600ms — too short for readable text
