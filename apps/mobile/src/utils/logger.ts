import { logger as sharedLogger } from '@sonora/shared';
import { getAppVersion } from '@/utils/app-version';

const enrich = (...args: unknown[]): unknown[] => [
  ...args,
  { app_version: getAppVersion().versionName },
];

export const logger = {
  debug: (...args: unknown[]) => sharedLogger.debug(...enrich(...args)),
  info: (...args: unknown[]) => sharedLogger.info(...enrich(...args)),
  warn: (...args: unknown[]) => sharedLogger.warn(...enrich(...args)),
  error: (...args: unknown[]) => sharedLogger.error(...enrich(...args)),
};
