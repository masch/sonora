/* eslint-disable no-console */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getCurrentLevel(): number {
  // Production: suppress debug (0) and info (1), show warn (2) and error (3)
  return (globalThis as { __DEV__?: boolean }).__DEV__ === false ? 2 : 0;
}

function log(level: LogLevel, ...args: unknown[]): void {
  if (LOG_LEVELS[level] >= getCurrentLevel()) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[${level.toUpperCase()}]`, ...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};
