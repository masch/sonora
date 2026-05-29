import type { ReactNode } from 'react';
import { ThemedText } from './themed-text';
import { TwView } from '@/tw';

type HintRowProps = {
  title?: string;
  hint?: ReactNode;
};

const DEFAULT_TITLE = 'Try editing';
const DEFAULT_HINT = 'src/app/index.tsx';

export function HintRow({ title, hint }: HintRowProps) {
  const resolvedTitle = title ?? DEFAULT_TITLE;
  const resolvedHint = hint ?? DEFAULT_HINT;
  return (
    <TwView className="flex-row justify-between">
      <ThemedText type="small">{resolvedTitle}</ThemedText>
      <TwView className="bg-backgroundSelected rounded-lg py-0.5 px-2">
        <ThemedText type="small" themeColor="textSecondary">{resolvedHint}</ThemedText>
      </TwView>
    </TwView>
  );
}
