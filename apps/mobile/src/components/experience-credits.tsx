import { CreditItem } from '@/components/credit-item';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';
import type { ExperienceCredit } from '@sonora/shared';
import type { TranslationKeys } from '@/i18n/types';

export { CreditItem };
export type { CreditItemProps } from '@/components/credit-item';

interface ExperienceCreditsProps {
  credits?: ExperienceCredit[] | null;
}

export function ExperienceCredits({ credits }: ExperienceCreditsProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  if (!credits || credits.length === 0) {
    return null;
  }

  return (
    <TwView
      className="w-full card-container-solid p-5 rounded-[24px] shadow-md backdrop-blur-md gap-3.5"
      testID="experience-credits"
    >
      <TwView className="flex-row items-center gap-2">
        <Icon name="music" size={14} tintColor={colors.textSecondary} />
        <ThemedText className="text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          {t('experiences.credits' as TranslationKeys)}
        </ThemedText>
      </TwView>

      <TwView className="gap-2.5">
        {credits.map((item) => (
          <CreditItem key={`${item.role}:${item.names}`} role={item.role} names={item.names} />
        ))}
      </TwView>
    </TwView>
  );
}
