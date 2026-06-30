import { type ConfigContext, type ExpoConfig } from 'expo/config';
import { fontConfig } from './src/config/font.ts';

const isStaging = process.env.APP_ENV === 'staging';

const ENV_CONFIG = {
  staging: {
    name: 'Sonora Staging',
    package: 'com.masch.sonora.staging',
    bundleIdentifier: 'com.masch.sonora.staging',
  },
  production: {
    name: 'Sonora',
    package: 'com.masch.sonora',
    bundleIdentifier: 'com.masch.sonora',
  },
};

const activeEnv = isStaging ? ENV_CONFIG.staging : ENV_CONFIG.production;

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: activeEnv.name,
    slug: 'sonora',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'sonora',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
      bundleIdentifier: activeEnv.bundleIdentifier,
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        UIBackgroundModes: ['audio'], // Changed to 'audio' for background playback support
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
      package: activeEnv.package,
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
      'expo-audio', // standard config plugin, options-free
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
          fonts: fontConfig.nativeFonts, // standard expo-font format
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
  };
};
