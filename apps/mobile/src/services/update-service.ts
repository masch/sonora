import { Linking, Platform } from 'react-native';
import i18next from 'i18next';
import { getStoreUrls } from './store-url';
import { PlayCoreUpdateProvider } from './play-core-provider';

export interface UpdateOptions {
  mode?: 'immediate' | 'flexible';
}

export interface UpdateProvider {
  name: string;
  isAvailable(): Promise<boolean>;
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

  async triggerUpdate(): Promise<void> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }

    const urls = getStoreUrls();
    try {
      const canOpen = await Linking.canOpenURL(urls.primary);
      if (canOpen) {
        await Linking.openURL(urls.primary);
        return;
      }
    } catch {
      // Primary URL failed, attempt fallback
    }

    if (urls.fallback) {
      await Linking.openURL(urls.fallback);
      return;
    }

    throw new Error(i18next.t('versionCheck.updateError'));
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

  async triggerUpdate(options?: UpdateOptions): Promise<void> {
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (available) {
          await provider.triggerUpdate(options);
          return;
        }
      } catch {
        // Graceful degradation: continue to next provider
      }
    }
  }
}

export const updateService = new UpdateService();
