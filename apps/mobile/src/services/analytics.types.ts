import type { AnalyticsEventMap } from './analytics-events';

export interface AnalyticsTracker {
  trackEvent<T extends keyof AnalyticsEventMap>(eventName: T, params?: AnalyticsEventMap[T]): void;
  recordError(error: Error, customDescription?: string): void;
  initializeGlobalErrorTracking(): Promise<void>;
}
