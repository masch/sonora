import type { ReactNode } from 'react';
import { useAppTranslation } from '@/hooks/use-translation';

import { ThemedText } from './themed-text';
import { TwView } from '@/tw';

type HintRowProps = {
  title?: string;
  hint?: ReactNode;
};

export function HintRow({ title, hint }: HintRowProps) {
  const { t } = useAppTranslation();
  const resolvedTitle = title ?? t('index.hintRow.title');
  const resolvedHint = hint ?? t('index.hintRow.hint');
  return (
    <TwView className="flex-row justify-between">
      <ThemedText type="small">{resolvedTitle}</ThemedText>
      <TwView className="bg-backgroundSelected rounded-lg py-0.5 px-2">
        <ThemedText type="small" themeColor="textSecondary">{resolvedHint}</ThemedText>
      </TwView>
    </TwView>
  );
}
