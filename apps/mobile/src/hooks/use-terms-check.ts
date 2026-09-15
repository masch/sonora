import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { type TermsResponse } from '@sonora/shared';
import { useAppTranslation } from '@/hooks/use-translation';
import { ApiClient } from '@/services/api-client';
import {
  getAcceptedTermsVersion,
  setAcceptedTermsVersion,
  getDeviceId,
} from '@/storage/app-storage';
import { logger } from '@/utils/logger';

export type TermsStatus =
  'checking' | 'needs_acceptance' | 'accepted' | 'offline_blocked' | 'error';

export interface UseTermsCheckResult {
  status: TermsStatus;
  terms: TermsResponse | null;
  error: string | null;
  acceptTerms: () => Promise<boolean>;
  retry: () => Promise<void>;
}

interface TermsCheckOutcome {
  status: TermsStatus;
  terms: TermsResponse | null;
  networkError?: boolean;
}

async function resolveTermsCheck(lang: 'en' | 'es'): Promise<TermsCheckOutcome> {
  const localVersion = await getAcceptedTermsVersion();

  try {
    const remoteData = await ApiClient.get<TermsResponse>(`/terms?lang=${lang}`, {
      skipCache: true,
    });
    if (!localVersion || localVersion !== remoteData.version) {
      return { status: 'needs_acceptance', terms: remoteData };
    }
    return { status: 'accepted', terms: remoteData };
  } catch (err) {
    logger.warn('[useTermsCheck] Failed to fetch remote terms:', err);
    if (!localVersion) {
      return { status: 'offline_blocked', terms: null, networkError: true };
    }
    // Previously accepted; allow app usage offline
    return { status: 'accepted', terms: null };
  }
}

export function useTermsCheck(): UseTermsCheckResult {
  const { t, language } = useAppTranslation();
  const [status, setStatus] = useState<TermsStatus>('checking');
  const [terms, setTerms] = useState<TermsResponse | null>(null);
  const [errorKey, setErrorKey] = useState<'networkError' | 'errorDescription' | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const outcome = await resolveTermsCheck(language);
      if (cancelled) return;

      setTerms(outcome.terms);
      setStatus(outcome.status);
      if (outcome.networkError) {
        setErrorKey('networkError');
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [language]);

  const retry = async () => {
    setStatus('checking');
    setErrorKey(null);
    const outcome = await resolveTermsCheck(language);
    setTerms(outcome.terms);
    setStatus(outcome.status);
    if (outcome.networkError) {
      setErrorKey('networkError');
    }
  };

  const acceptTerms = async (): Promise<boolean> => {
    if (!terms) return false;

    try {
      const deviceId = await getDeviceId();
      const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

      await ApiClient.post('/terms/accept', {
        deviceId,
        version: terms.version,
        lang: terms.lang,
        contentHash: terms.contentHash,
        platform,
      });

      await setAcceptedTermsVersion(terms.version);
      setStatus('accepted');
      return true;
    } catch (err) {
      logger.error('[useTermsCheck] Failed to submit acceptance:', err);
      setErrorKey('errorDescription');
      return false;
    }
  };

  const error = errorKey
    ? errorKey === 'networkError'
      ? t('terms.networkError')
      : t('terms.errorDescription')
    : null;

  return {
    status,
    terms,
    error,
    acceptTerms,
    retry,
  };
}
