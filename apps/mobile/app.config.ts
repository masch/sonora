import { type ConfigContext, type ExpoConfig } from 'expo/config';
import { fontConfig } from './src/config/font.ts';
import APP_IDENTIFIERS from '../../packages/shared/src/app-identifiers.json';

const isProduction = process.env.APP_ENV === 'production';

const ENV_CONFIG = {
  staging: {
    name: 'Sonora Staging',
    appId: APP_IDENTIFIERS.staging.appId,
    domain: 'sonora-api-staging.sonora-api.workers.dev',
    scheme: APP_IDENTIFIERS.staging.scheme,
    icon: './assets/images/sonora/logo_staging.png',
    adaptiveIconForeground: './assets/images/sonora/logo_staging.png',
    splashColor: '#F59E0B',
  },
  production: {
    name: 'Sonora',
    appId: APP_IDENTIFIERS.production.appId,
    domain: 'sonora-api.sonora-api.workers.dev',
    scheme: APP_IDENTIFIERS.production.scheme,
    icon: './assets/images/icon.png',
    adaptiveIconForeground: './assets/images/android-icon-foreground.png',
    splashColor: '#208AEF',
  },
};

const activeEnv = isProduction ? ENV_CONFIG.production : ENV_CONFIG.staging;

const appVersionName = process.env.APP_VERSION_NAME;
if (!appVersionName) {
  throw new Error(
    'APP_VERSION_NAME environment variable is required. ' +
      'Set it via CI (extracted from git tag) or pass it manually for local builds.',
  );
}

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: activeEnv.name,
    slug: 'sonora',
    version: appVersionName,
    orientation: 'portrait',
    icon: activeEnv.icon,
    scheme: activeEnv.scheme,
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: activeEnv.appId,
      googleServicesFile: './GoogleService-Info.plist',
      associatedDomains: [`applinks:${activeEnv.domain}`],
      infoPlist: {
        UIBackgroundModes: ['fetch'],
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: activeEnv.adaptiveIconForeground,
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      package: activeEnv.appId,
      googleServicesFile: './google-services.json',
      versionCode: process.env.APP_VERSION_CODE ? parseInt(process.env.APP_VERSION_CODE, 10) : 6,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: activeEnv.domain,
              pathPrefix: '/payments',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      output: 'single',
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
          backgroundColor: activeEnv.splashColor,
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
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            // Enable R8 minification/obfuscation in release builds so the
            // mapping.txt deobfuscation file is generated and uploaded to
            // Google Play Console (required for crash/ANR symbolication).
            enableMinifyInReleaseBuilds: true,
            debugSymbolLevel: 'SYMBOL_TABLE',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appVersionName: appVersionName,
      appVersionCode: process.env.APP_VERSION_CODE ? parseInt(process.env.APP_VERSION_CODE, 10) : 0,
      router: {},
      eas: {
        projectId: 'ef4f0ad4-7ef6-4b37-858a-b1fc857d048a',
      },
      isProduction: process.env.APP_ENV === 'production',
      domain: activeEnv.domain,
    },
    owner: 'sonoraderivapoeticas-team',
  };
};
