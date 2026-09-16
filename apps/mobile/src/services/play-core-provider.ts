import type { UpdateOptions, UpdateProvider } from './update-service';

/**
 * Web/Stub implementation of PlayCoreUpdateProvider.
 * Google Play Core is native Android only. On web, it is never available.
 */
export class PlayCoreUpdateProvider implements UpdateProvider {
  name = 'play-core';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async triggerUpdate(_options?: UpdateOptions): Promise<void> {
    // No-op / not available on web
  }
}
