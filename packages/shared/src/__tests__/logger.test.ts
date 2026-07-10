import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { logger } from '../utils/logger';

describe('logger', () => {
  const G = globalThis as { __DEV__?: boolean };
  const originalDev = G.__DEV__;

  beforeEach(() => {
    vi.restoreAllMocks();
    G.__DEV__ = true;
  });

  afterAll(() => {
    G.__DEV__ = originalDev;
  });

  describe('log levels', () => {
    it('logger.debug calls console.log with [DEBUG] prefix', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('test message');
      expect(spy).toHaveBeenCalledWith('[DEBUG]', 'test message');
    });

    it('logger.info calls console.log with [INFO] prefix', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('info message');
      expect(spy).toHaveBeenCalledWith('[INFO]', 'info message');
    });

    it('logger.warn calls console.warn with [WARN] prefix', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warn message');
      expect(spy).toHaveBeenCalledWith('[WARN]', 'warn message');
    });

    it('logger.error calls console.error with [ERROR] prefix', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('error message');
      expect(spy).toHaveBeenCalledWith('[ERROR]', 'error message');
    });
  });

  describe('multiple arguments', () => {
    it('passes additional metadata to the console function', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const meta = { code: 404, source: 'api' };
      logger.info('request failed', meta);
      expect(spy).toHaveBeenCalledWith('[INFO]', 'request failed', meta);
    });

    it('handles multiple metadata arguments', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('event', 'user-login', { userId: 42 });
      expect(spy).toHaveBeenCalledWith('[INFO]', 'event', 'user-login', { userId: 42 });
    });
  });

  describe('environment-aware suppression', () => {
    it('suppresses debug in production', () => {
      G.__DEV__ = false;
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('suppresses info in production', () => {
      G.__DEV__ = false;
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('shows warn in production', () => {
      G.__DEV__ = false;
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warning in prod');
      expect(spy).toHaveBeenCalledWith('[WARN]', 'warning in prod');
    });

    it('shows error in production', () => {
      G.__DEV__ = false;
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('error in prod');
      expect(spy).toHaveBeenCalledWith('[ERROR]', 'error in prod');
    });
  });

  describe('edge cases', () => {
    it('handles no arguments gracefully', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info();
      expect(spy).toHaveBeenCalledWith('[INFO]');
    });

    it('handles undefined and null arguments', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info(undefined);
      expect(spy).toHaveBeenCalledWith('[INFO]', undefined);
    });
  });
});
