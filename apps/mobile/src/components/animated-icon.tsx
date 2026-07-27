import { getAppVersion } from '@/utils/app-version';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SPLASH_ICON } from '@/constants/images';
import { SPLASH_COLORS } from '@/constants/theme';
import { TwImage, TwText, TwView } from '@/tw';
import { TwAnimatedView } from '@/tw/animated';

// react-doctor-disable-next-line deslop/unused-export — false positive: used in _layout.tsx via @/ alias
export function AnimatedSplashOverlay({ isReady = true }: { isReady?: boolean }) {
  const [visible, setVisible] = useState(true);
  const opacity = useSharedValue(1);

  const versionText = getAppVersion().formatted;
  const isProduction = Constants.expoConfig?.extra?.isProduction === true;
  const backgroundColor = isProduction ? SPLASH_COLORS.production : SPLASH_COLORS.staging;

  useEffect(() => {
    if (!isReady) return;

    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 500 }, (finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [isReady, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <TwAnimatedView
      className="absolute inset-0 justify-center items-center z-[200]"
      style={[{ backgroundColor }, animatedStyle]}
    >
      <AnimatedIcon />
      {versionText && (
        <TwText className="absolute self-center bottom-12 text-xs font-semibold text-white tracking-[0.5px]">
          {versionText}
        </TwText>
      )}
    </TwAnimatedView>
  );
}

// react-doctor-disable-next-line deslop/unused-export — false positive: used externally via @/ alias
export function AnimatedIcon() {
  return (
    <TwView className="justify-center items-center w-[76px] h-[76px] z-[100]">
      <TwImage
        className="w-[76px] h-[76px] rounded-full overflow-hidden"
        source={SPLASH_ICON}
        alt=""
        resizeMode="cover"
      />
    </TwView>
  );
}
