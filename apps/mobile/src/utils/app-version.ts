import Constants from 'expo-constants';

export interface AppVersion {
  versionName: string;
  versionCode: number;
  formatted: string;
}

export function getAppVersion(): AppVersion {
  const versionName =
    (Constants.expoConfig?.extra?.appVersionName as string | undefined) ?? '0.0.0';
  const versionCode = (Constants.expoConfig?.extra?.appVersionCode as number | undefined) ?? 0;

  return {
    versionName,
    versionCode,
    formatted: `${versionName} (${versionCode})`,
  };
}
