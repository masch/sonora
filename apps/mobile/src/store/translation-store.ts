import { create } from 'zustand';
import i18next from 'i18next';
import type { TranslationEntry } from '@sonora/shared';
import { TranslationEntrySchema } from '@sonora/shared';
import { getCachedTranslations, setCachedTranslations } from '../storage/translation-cache';
import { ApiClient } from '../services/api-client';

const TRANSLATION_TIMEOUT_MS = 3000;

interface TranslationState {
  overridesByLang: Record<string, Record<string, string>>;
  isLoading: boolean;
  error: Error | null;
  /** Initialise translations: detect language and start fetch. Non-blocking. */
  init: () => void;
  /** Fetch and cache translation overrides for a specific language. */
  fetchLanguage: (lang: string) => Promise<void>;
}

export const useTranslationStore = create<TranslationState>((set, get) => ({
  overridesByLang: {},
  isLoading: false,
  error: null,

  init: () => {
    const lang = i18next.language || 'en';
    // Fire-and-forget — non-blocking per spec
    get().fetchLanguage(lang);
  },

  fetchLanguage: async (lang: string) => {
    set({ isLoading: true, error: null });

    // 1. Read cache first for instant render
    let cached: Record<string, string> | null = null;
    try {
      cached = await getCachedTranslations(lang);
      if (cached) {
        set((state) => ({
          overridesByLang: { ...state.overridesByLang, [lang]: cached! },
        }));
      }
    } catch {
      // Cache read failed — silent
    }

    // 2. Fetch API with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);
    let apiError: unknown = null;
    let merged: Record<string, string> = { ...(cached ?? {}) };

    try {
      const raw = await ApiClient.get<Record<string, string>>(`/api/translations/${lang}`, {
        signal: controller.signal,
      });

      // Validate each API entry against TranslationEntrySchema
      const validEntries: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        const parsed = TranslationEntrySchema.safeParse({
          lang,
          key,
          value,
        } satisfies TranslationEntry);
        if (parsed.success) {
          validEntries[key] = value;
        }
      }

      // Merge: API wins over cache
      merged = { ...(cached ?? {}), ...validEntries };

      // Write merged result back to cache
      await setCachedTranslations(lang, merged);
    } catch (err) {
      apiError = err;
    } finally {
      clearTimeout(timer);
    }

    // 3. Handle errors
    if (apiError) {
      if (apiError instanceof Error && apiError.name === 'AbortError') {
        // Timeout — not an actionable error, keep cache
        set({ isLoading: false });
        return;
      }
      if (!cached) {
        // No cache and network failed — silent .ts fallback, no error surfaced
        set({ isLoading: false });
        return;
      }
      // Cache exists and network failed — keep cache, no error surfaced
      set({ isLoading: false });
      return;
    }

    // 4. Update state with merged result
    set((state) => ({
      overridesByLang: { ...state.overridesByLang, [lang]: merged },
      isLoading: false,
      error: null,
    }));
  },
}));
