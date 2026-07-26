import * as Application from 'expo-application';

export interface AppVersion {
  versionName: string;
  formatted: string;
}

export function getAppVersion(): AppVersion {
  const versionName = Application.nativeApplicationVersion ?? '0.0.0';

  return {
    versionName,
    formatted: versionName,
  };
}
