import React from 'react';
import { TwImage } from '@/tw/image';
import { APP_CONFIG } from '@/config/app-config';
import { SONORA_LOGO, SONORA_LOGO_STAGING } from '@/constants/images';
import { useAppTranslation } from '@/hooks/use-translation';

interface AppLogoProps {
  className?: string;
}

export function AppLogo({ className = 'w-full h-full' }: AppLogoProps) {
  const { t } = useAppTranslation();

  return (
    <TwImage
      source={APP_CONFIG.isProduction ? SONORA_LOGO : SONORA_LOGO_STAGING}
      className={className}
      contentFit="contain"
      alt={t('home.bannerAlt')}
    />
  );
}
