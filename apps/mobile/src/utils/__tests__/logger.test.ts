/**
 * Logger tests — TDD cycle for src/utils/logger.ts
 *
 * Tests follow the spec:
 * - GIVEN logger.debug/info/warn/error → THEN each calls correct console method with [LEVEL] prefix
 * - GIVEN production (__DEV__ is false) → THEN debug/info suppressed, warn/error still output
 * - GIVEN getAppVersion() is mocked → THEN every call appends a trailing { app_version } object
 */

import { logger } from '../logger';

jest.mock('@/utils/app-version', () => ({
  getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }),
}));

describe('logger', () => {
  const G = globalThis as { __DEV__?: boolean };
  const originalDev = G.__DEV__;

  beforeEach(() => {
    jest.restoreAllMocks();
    G.__DEV__ = true;
  });

  afterAll(() => {
    G.__DEV__ = originalDev;
  });

  describe('log levels', () => {
    it('logger.debug calls console.log with [DEBUG] prefix', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('test message');
      expect(spy).toHaveBeenCalledWith('[DEBUG]', 'test message', { app_version: 'test-version' });
    });

    it('logger.info calls console.log with [INFO] prefix', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('info message');
      expect(spy).toHaveBeenCalledWith('[INFO]', 'info message', { app_version: 'test-version' });
    });

    it('logger.warn calls console.warn with [WARN] prefix', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warn message');
      expect(spy).toHaveBeenCalledWith('[WARN]', 'warn message', { app_version: 'test-version' });
    });

    it('logger.error calls console.error with [ERROR] prefix', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('error message');
      expect(spy).toHaveBeenCalledWith('[ERROR]', 'error message', { app_version: 'test-version' });
    });
  });

  describe('multiple arguments', () => {
    it('passes additional metadata to the console function', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const meta = { code: 404, source: 'api' };
      logger.info('request failed', meta);
      expect(spy).toHaveBeenCalledWith('[INFO]', 'request failed', meta, {
        app_version: 'test-version',
      });
    });

    it('handles multiple metadata arguments', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('event', 'user-login', { userId: 42 });
      expect(spy).toHaveBeenCalledWith(
        '[INFO]',
        'event',
        'user-login',
        { userId: 42 },
        {
          app_version: 'test-version',
        },
      );
    });
  });

  describe('environment-aware suppression', () => {
    it('suppresses debug in production', () => {
      G.__DEV__ = false;
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('suppresses info in production', () => {
      G.__DEV__ = false;
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('shows warn in production', () => {
      G.__DEV__ = false;
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warning in prod');
      expect(spy).toHaveBeenCalledWith('[WARN]', 'warning in prod', {
        app_version: 'test-version',
      });
    });

    it('shows error in production', () => {
      G.__DEV__ = false;
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('error in prod');
      expect(spy).toHaveBeenCalledWith('[ERROR]', 'error in prod', {
        app_version: 'test-version',
      });
    });
  });

  describe('edge cases', () => {
    it('handles no arguments gracefully', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      logger.info();
      expect(spy).toHaveBeenCalledWith('[INFO]', { app_version: 'test-version' });
    });

    it('handles undefined and null arguments', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      logger.info(undefined);
      expect(spy).toHaveBeenCalledWith('[INFO]', undefined, { app_version: 'test-version' });
    });
  });

  describe('app_version enrichment', () => {
    it('appends app_version metadata to every level', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(logSpy).toHaveBeenCalledWith('[DEBUG]', 'd', { app_version: 'test-version' });
      expect(logSpy).toHaveBeenCalledWith('[INFO]', 'i', { app_version: 'test-version' });
      expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'w', { app_version: 'test-version' });
      expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'e', { app_version: 'test-version' });
    });
  });
});
