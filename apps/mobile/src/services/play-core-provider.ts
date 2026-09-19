import type { UpdateOptions, CheckForUpdateOptions, UpdateProvider } from './update-service';

/**
 * Web/Stub implementation of PlayCoreUpdateProvider.
 * Google Play Core is native Android only. On web, it is never available.
 */
// react-doctor-disable-next-line deslop/unused-export -- Metro platform-split: this web stub is the resolved module when .native.ts takes precedence on Android
export class PlayCoreUpdateProvider implements UpdateProvider {
  name = 'play-core';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async checkForUpdate(_options: CheckForUpdateOptions): Promise<boolean> {
    return false;
  }

  async triggerUpdate(_options?: UpdateOptions): Promise<void> {
    // No-op / not available on web
  }
}
