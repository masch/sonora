import React from 'react';
import { TwView, TwText } from '@/tw';

import { useTranslation } from 'react-i18next';

export function StagingBadge() {
  const { t } = useTranslation();
  return (
    <TwView className="absolute top-4 right-4 z-50 flex-row items-center gap-1.5 px-3 py-1 bg-amber-500 rounded-full border border-amber-400/30 shadow-md pointer-events-none">
      <TwView className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
      <TwText className="text-[10px] font-bold text-white tracking-widest uppercase font-mono">
        {t('common.staging')}
      </TwText>
    </TwView>
  );
}
