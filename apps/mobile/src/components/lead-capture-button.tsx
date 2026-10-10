import { useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';
import { LeadCaptureModal } from '@/components/lead-capture-modal';
import type { LeadSource } from '@sonora/shared';

export interface LeadCaptureButtonProps {
  source: LeadSource;
  experienceId?: string;
  className?: string;
}

export function LeadCaptureButton({ source, experienceId, className }: LeadCaptureButtonProps) {
  const { t } = useAppTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TwView className={className ?? 'border border-emerald-500/30 rounded-xl overflow-hidden'}>
        <TwPressable
          accessibilityLabel={t('leadCapture.button')}
          testID="lead-capture-open-button"
          className="py-3 items-center active:opacity-80 bg-emerald-500/10 dark:bg-emerald-500/20"
          onPress={() => setVisible(true)}
        >
          <ThemedText className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
            {t('leadCapture.button')}
          </ThemedText>
        </TwPressable>
      </TwView>

      <LeadCaptureModal
        visible={visible}
        onDismiss={() => setVisible(false)}
        source={source}
        experienceId={experienceId}
      />
    </>
  );
}

export default LeadCaptureButton;
