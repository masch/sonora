import Constants from 'expo-constants';

export interface AppVersion {
  versionName: string;
  versionCode: number;
  formatted: string;
}

export function getAppVersion(): AppVersion | null {
  const versionName = Constants.expoConfig?.extra?.appVersionName as string | undefined;
  const versionCode = Constants.expoConfig?.extra?.appVersionCode as number | undefined;

  if (!versionName || versionCode === undefined) return null;

  return {
    versionName,
    versionCode,
    formatted: `${versionName} (${versionCode})`,
  };
}
