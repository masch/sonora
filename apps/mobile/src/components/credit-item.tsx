import { ThemedText } from '@/components/themed-text';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwText, TwView } from '@/tw';
import type { TranslationKeys } from '@/i18n/types';

export interface CreditItemProps {
  role: string;
  names: string;
  testID?: string;
  accessibilityLabel?: string;
}

export function CreditItem({ role, names, testID, accessibilityLabel }: CreditItemProps) {
  const { t } = useAppTranslation();

  const roleLabel = t(`experiences.creditRoles.${role}` as TranslationKeys, {
    defaultValue: role,
  });

  const resolvedAccessibilityLabel = accessibilityLabel ?? `${roleLabel}: ${names}`;

  return (
    <TwView
      className="card-container p-3.5 rounded-xl gap-1.5"
      testID={testID}
      accessibilityLabel={resolvedAccessibilityLabel}
    >
      <TwText className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        {roleLabel}
      </TwText>
      <ThemedText className="text-sm font-semibold leading-snug">{names}</ThemedText>
    </TwView>
  );
}
