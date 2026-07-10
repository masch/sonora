import { appStorage } from './app-storage';

function cacheKey(lang: string): string {
  return `translations:${lang}`;
}

export async function getCachedTranslations(lang: string): Promise<Record<string, string> | null> {
  try {
    const raw = await appStorage.getItem(cacheKey(lang));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

export async function setCachedTranslations(
  lang: string,
  translations: Record<string, string>,
): Promise<void> {
  await appStorage.setItem(cacheKey(lang), JSON.stringify(translations));
}

export async function clearCachedTranslations(lang: string): Promise<void> {
  await appStorage.removeItem(cacheKey(lang));
}
