import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/config/app-config';

import { SPLASH_ICONS } from '@/constants/images';
import { SPLASH_COLORS } from '@/constants/theme';
import { TwImage, TwText, TwView } from '@/tw';
import { getAppVersion } from '@/utils/app-version';

export function AnimatedSplashOverlay({ isReady = true }: { isReady?: boolean }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  const versionText = getAppVersion().formatted;
  const backgroundColor = SPLASH_COLORS[APP_CONFIG.appEnv];

  useEffect(() => {
    if (!isReady) return;

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1500);

    const timer = setTimeout(() => {
      setVisible(false);
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(timer);
    };
  }, [isReady]);

  if (!visible) return null;

  return (
    <TwView
      className={`absolute inset-0 justify-center items-center z-[200] transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor }}
    >
      <AnimatedIcon />
      {versionText && (
        <TwText className="absolute self-center bottom-12 text-xs font-semibold text-white tracking-[0.5px]">
          {versionText}
        </TwText>
      )}
    </TwView>
  );
}

export function AnimatedIcon() {
  return (
    <TwView className="justify-center items-center w-[76px] h-[76px] z-[100]">
      <TwImage
        className="w-[76px] h-[76px] rounded-full overflow-hidden"
        source={SPLASH_ICONS[APP_CONFIG.appEnv]}
        alt=""
        contentFit="cover"
        priority="high"
        cachePolicy="memory-disk"
        transition={0}
      />
    </TwView>
  );
}
