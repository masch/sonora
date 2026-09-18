import { CreditItem } from '@/components/credit-item';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';
import type { ExperienceCredit } from '@sonora/shared';
import type { TranslationKeys } from '@/i18n/types';

interface ExperienceCreditsProps {
  credits?: ExperienceCredit[] | null;
}

function isValidCredit(item: unknown): item is ExperienceCredit {
  return (
    typeof item === 'object' &&
    item !== null &&
    'role' in item &&
    'names' in item &&
    typeof (item as ExperienceCredit).role === 'string' &&
    typeof (item as ExperienceCredit).names === 'string' &&
    (item as ExperienceCredit).role.trim().length > 0 &&
    (item as ExperienceCredit).names.trim().length > 0
  );
}

export function ExperienceCredits({ credits }: ExperienceCreditsProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  // Presentational sub-component: detail views (TrackDetailView / TripDetailView)
  // handle async states. When an experience has no credits, this section is omitted.
  if (!credits || !Array.isArray(credits) || credits.length === 0) {
    return null;
  }

  const validItems = credits.filter(isValidCredit);
  if (validItems.length === 0) {
    return null;
  }

  return (
    <TwView
      className="w-full card-container-solid p-5 rounded-[24px] shadow-md backdrop-blur-md gap-3.5"
      testID="experience-credits"
    >
      <TwView className="flex-row items-center gap-2">
        <Icon
          name="music"
          size={14}
          tintColor={colors.textSecondary}
          testID="experience-credits-header-icon"
          accessibilityLabel={t('experiences.credits' as TranslationKeys)}
        />
        <ThemedText className="text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          {t('experiences.credits' as TranslationKeys)}
        </ThemedText>
      </TwView>

      <TwView className="gap-2.5">
        {validItems.map((item) => (
          <CreditItem
            key={`${item.role}:${item.names}`}
            role={item.role}
            names={item.names}
            testID={`credit-item-${item.role}`}
            accessibilityLabel={`${item.role}: ${item.names}`}
          />
        ))}
      </TwView>
    </TwView>
  );
}
