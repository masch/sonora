const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? window?.location?.origin : 'http://localhost:8787');

const isProduction =
  process.env.EXPO_PUBLIC_API_URL !== undefined &&
  !process.env.EXPO_PUBLIC_API_URL.includes('staging') &&
  !process.env.EXPO_PUBLIC_API_URL.includes('localhost') &&
  !process.env.EXPO_PUBLIC_API_URL.includes('127.0.0.1');

export const APP_CONFIG = {
  apiBaseUrl,
  isProduction,
};
