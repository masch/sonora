import { type ConfigContext, type ExpoConfig } from 'expo/config';
import { fontConfig } from './src/config/font.ts';

const isProduction = process.env.APP_ENV === 'production';

const ENV_CONFIG = {
  staging: {
    name: 'Sonora Staging',
    appId: 'com.masch.sonora.staging',
  },
  production: {
    name: 'Sonora',
    appId: 'com.masch.sonora',
  },
};

const activeEnv = isProduction ? ENV_CONFIG.production : ENV_CONFIG.staging;

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: activeEnv.name,
    slug: 'sonora',
    version: '1.0.0',
    orientation: 'portrait',
    icon: isProduction ? './assets/images/icon.png' : './assets/images/sonora/logo_staging.png',
    scheme: 'sonora',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
      bundleIdentifier: activeEnv.appId,
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        UIBackgroundModes: ['fetch'],
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: isProduction
          ? './assets/images/android-icon-foreground.png'
          : './assets/images/sonora/logo_staging.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      package: activeEnv.appId,
      googleServicesFile: './google-services.json',
      versionCode: process.env.APP_VERSION_CODE ? parseInt(process.env.APP_VERSION_CODE, 10) : 6,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      '@react-native-firebase/app',
      '@react-native-firebase/crashlytics',
      'expo-router',
      [
        'expo-audio',
        {
          enableBackgroundPlayback: true,
        },
      ],
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
      isProduction: process.env.APP_ENV === 'production',
    },
    owner: 'sonoraderivapoeticas-team',
  };
};
