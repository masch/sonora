import type { ReactNode } from 'react';
import { ThemedText } from './themed-text';
import { TwView } from '@/tw';

interface HintRowProps {
  title: string;
  hint: ReactNode;
}

export function HintRow({ title, hint }: HintRowProps) {
  return (
    <TwView className="flex-row justify-between">
      <ThemedText type="small" className="text-zinc-700">
        {title}
      </ThemedText>
      <TwView className="bg-backgroundSelected rounded-lg py-0.5 px-2">
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </TwView>
    </TwView>
  );
}
