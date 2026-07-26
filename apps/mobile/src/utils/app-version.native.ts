import * as Application from 'expo-application';

export interface AppVersion {
  versionName: string;
  versionCode: number;
  formatted: string;
}

export function getAppVersion(): AppVersion {
  const versionName = Application.nativeApplicationVersion ?? '0.0.0';
  const versionCode = Application.nativeBuildVersion
    ? parseInt(Application.nativeBuildVersion, 10)
    : 0;

  return {
    versionName,
    versionCode,
    formatted: `${versionName} (${versionCode})`,
  };
}
