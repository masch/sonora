import Constants from 'expo-constants';

export interface AppVersion {
  versionName: string;
  formatted: string;
}

export function getAppVersion(): AppVersion {
  const versionName =
    (Constants.expoConfig?.extra?.appVersionName as string | undefined) ?? '0.0.0';

  return {
    versionName,
    formatted: versionName,
  };
}
