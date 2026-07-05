const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? window?.location?.origin : 'http://localhost:8787');

export const APP_CONFIG = {
  apiBaseUrl,
};
