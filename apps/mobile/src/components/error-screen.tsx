import React from 'react';

import { Button } from '@/components/ui/button';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwText, TwView } from '@/tw';
import { errorReference } from '@/utils/error-reference';

export interface ErrorScreenProps {
  error: Error;
  retry: () => void;
  onGoHome: () => void;
}

/**
 * The last screen a walker sees when the app crashes: what happened in plain
 * words, the reference we can look the crash up by, and two ways out.
 *
 * Production deliberately shows the reference instead of `error.message`: an
 * internal message ("this.validatePath is not a function") is noise to the
 * walker, while the reference is something we can both quote.
 */
export function ErrorScreen({ error, retry, onGoHome }: ErrorScreenProps) {
  const { t } = useAppTranslation();
  const reference = errorReference(error);

  return (
    <TwView className="flex-1 justify-center items-center p-6 bg-slate-900">
      <TwText className="text-xl font-bold text-white mb-2">
        {t('common.somethingWentWrong')}
      </TwText>
      <TwText className="text-slate-300 text-center mb-6">{t('common.errorHint')}</TwText>
      <TwText className="text-slate-400 text-xs uppercase tracking-wide mb-1">
        {t('common.errorReference')}
      </TwText>
      <TwText className="font-mono text-white text-base mb-6" testID="error-reference" selectable>
        {reference}
      </TwText>
      {__DEV__ && (
        <TwText className="text-red-400 text-center mb-6" testID="error-message">
          {error.message}
        </TwText>
      )}
      <Button
        label={t('common.retry')}
        onPress={retry}
        testID="retry-button"
        accessibilityLabel={t('common.retry')}
      />
      <Button
        label={t('common.goHome')}
        variant="secondary"
        onPress={onGoHome}
        testID="error-go-home"
        accessibilityLabel={t('common.goHome')}
        className="mt-2"
      />
    </TwView>
  );
}
