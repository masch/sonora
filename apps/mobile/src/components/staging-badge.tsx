import React from 'react';
import { Platform } from 'react-native';
import { TwView, TwText } from '@/tw';

import { useAppTranslation } from '@/hooks/use-translation';

export function StagingBadge() {
  const { t } = useAppTranslation();
  // Safe top padding depending on notch/status bar (handled by parent's safe area or absolute top)
  const topInset = Platform.OS === 'ios' ? 'top-14' : 'top-10';

  return (
    <TwView
      pointerEvents="none"
      className={`absolute ${topInset} right-4 z-50 flex-row items-center gap-1.5 px-3 py-1 bg-amber-500/90 rounded-full border border-amber-400/30 shadow-lg shadow-amber-600/20`}
    >
      <TwView className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
      <TwText className="text-[10px] font-bold text-white tracking-widest uppercase font-mono">
        {t('common.staging')}
      </TwText>
    </TwView>
  );
}
