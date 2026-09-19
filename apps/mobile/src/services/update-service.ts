import { Linking, Platform } from 'react-native';
import { t } from 'i18next';
import { getStoreUrls } from './store-url';
import { PlayCoreUpdateProvider } from './play-core-provider';
import { AnalyticsService } from './analytics';
import type { UpdateCheckSource } from './analytics-events';
import { getAppVersion } from '@/utils/app-version';
import { getLastInstalledVersion, setLastInstalledVersion } from '@/storage/app-storage';
import { logger } from '@/utils/logger';

export interface UpdateOptions {
  mode?: 'immediate' | 'flexible';
}

export interface CheckForUpdateOptions {
  source: UpdateCheckSource;
}

export interface UpdateProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  checkForUpdate?(options: CheckForUpdateOptions): Promise<boolean>;
  triggerUpdate(options?: UpdateOptions): Promise<void>;
}

/**
 * Fallback update provider using platform store deep links.
 * Works across Android, iOS, and Web environments.
 */
export class DeepLinkUpdateProvider implements UpdateProvider {
  name = 'deep-link';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async checkForUpdate(_options: CheckForUpdateOptions): Promise<boolean> {
    return false;
  }

  async triggerUpdate(): Promise<void> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      AnalyticsService.trackEvent('update_store_redirect', {
        platform: 'web',
        url: 'window.location.reload',
      });
      window.location.reload();
      return;
    }

    const urls = getStoreUrls();
    try {
      const canOpen = await Linking.canOpenURL(urls.primary);
      if (canOpen) {
        await Linking.openURL(urls.primary);
        AnalyticsService.trackEvent('update_store_redirect', {
          platform: Platform.OS,
          url: urls.primary,
        });
        return;
      }
    } catch {
      // Primary URL failed, attempt fallback
    }

    if (urls.fallback) {
      await Linking.openURL(urls.fallback);
      AnalyticsService.trackEvent('update_store_redirect', {
        platform: Platform.OS,
        url: urls.fallback,
      });
      return;
    }

    throw new Error(t('versionCheck.updateError'));
  }
}

/**
 * Strategy-pattern update service coordinator.
 * Tries providers in registered order, gracefully falling back
 * if a provider is unavailable or encounters a runtime error.
 */
export class UpdateService {
  private providers: UpdateProvider[] = [];

  constructor(providers?: UpdateProvider[]) {
    this.providers = providers
      ? [...providers]
      : [new PlayCoreUpdateProvider(), new DeepLinkUpdateProvider()];
  }

  registerProvider(provider: UpdateProvider, prepend = true): void {
    if (prepend) {
      this.providers.unshift(provider);
    } else {
      this.providers.push(provider);
    }
  }

  async checkForUpdate(options: CheckForUpdateOptions): Promise<boolean> {
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (available && provider.checkForUpdate) {
          return await provider.checkForUpdate(options);
        }
      } catch (err) {
        // Graceful degradation: log and continue to next provider
        logger.warn(`[UpdateService] Provider ${provider.name} failed during checkForUpdate:`, err);
      }
    }
    return false;
  }

  async triggerUpdate(options?: UpdateOptions): Promise<void> {
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (available) {
          await provider.triggerUpdate(options);
          return;
        }
      } catch (err) {
        // Graceful degradation: log and continue to next provider
        logger.warn(`[UpdateService] Provider ${provider.name} failed during triggerUpdate:`, err);
      }
    }
  }

  /**
   * Checks whether the app was updated since the last launch.
   * Emits 'update_installed' analytics event if the current version differs from the stored version.
   * On fresh install (no prior version stored), it records the current version without emitting.
   */
  async checkForInstalledUpdate(
    storage: {
      getLastInstalledVersion: () => Promise<string | null>;
      setLastInstalledVersion: (version: string) => Promise<void>;
    } = { getLastInstalledVersion, setLastInstalledVersion },
    versionProvider: () => string = () => getAppVersion().versionName,
  ): Promise<boolean> {
    const currentVersion = versionProvider();
    const lastVersion = await storage.getLastInstalledVersion();

    if (lastVersion && lastVersion !== currentVersion) {
      AnalyticsService.trackEvent('update_installed', {
        status: 'installed',
        previous_version: lastVersion,
        current_version: currentVersion,
      });
      await storage.setLastInstalledVersion(currentVersion);
      return true;
    }

    if (!lastVersion) {
      await storage.setLastInstalledVersion(currentVersion);
    }

    return false;
  }
}

export const updateService = new UpdateService();
