import { type ExpoConfig, type ConfigContext } from 'expo/config';
import { fontConfig } from './src/config/font.ts';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'sonora',
  slug: 'sonora',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'sonora',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.masch.sonora',
    infoPlist: {
      UIBackgroundModes: ['fetch'],
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: 'com.masch.sonora',
    versionCode: process.env.APP_VERSION_CODE ? parseInt(process.env.APP_VERSION_CODE, 10) : 6,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
    'expo-localization',
    'expo-asset',
    [
      'expo-font',
      {
        fonts: fontConfig.nativeFonts,
        android: {
          fonts: [
            {
              fontFamily: fontConfig.family,
              fontDefinitions: fontConfig.androidFonts.map((f) => ({
                path: f.path,
                weight: f.weight,
              })),
            },
          ],
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'ef4f0ad4-7ef6-4b37-858a-b1fc857d048a',
    },
  },
  owner: 'sonoraderivapoeticas-team',
});
