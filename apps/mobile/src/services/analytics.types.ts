import type { AnalyticsEventMap } from './analytics-events';

/**
 * Extra, optional context for a reported crash.
 *
 * `reference` is the same code the walker reads on the error screen (see
 * `errorReference`), so a support message can be found in the metrics.
 */
export interface ErrorContext {
  reference?: string;
  route?: string;
  fatal?: boolean;
}

export interface AnalyticsTracker {
  trackEvent<T extends keyof AnalyticsEventMap>(eventName: T, params?: AnalyticsEventMap[T]): void;
  recordError(error: Error, customDescription?: string, context?: ErrorContext): void;
  initializeGlobalErrorTracking(): Promise<void>;
}
