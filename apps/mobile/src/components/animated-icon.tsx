import { getAppVersion } from '@/utils/app-version';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Easing, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { EXPO_LOGO } from '@/constants/images';
import { SPLASH_COLORS } from '@/constants/theme';
import { TwText, TwView } from '@/tw';
import { TwAnimatedView } from '@/tw/animated';

const DURATION = 2000;

// react-doctor-disable-next-line deslop/unused-export — false positive: used in _layout.tsx via @/ alias
export function AnimatedSplashOverlay() {
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion();

  const versionText = getAppVersion().formatted;

  const isProduction = Constants.expoConfig?.extra?.isProduction === true;
  const backgroundColor = isProduction ? SPLASH_COLORS.production : SPLASH_COLORS.staging;

  useEffect(() => {
    if (reducedMotion) {
      const timer = setTimeout(() => setVisible(false), DURATION);
      return () => clearTimeout(timer);
    }
  }, [reducedMotion]);

  if (!visible) return null;

  const scaleFactor = height / 90;

  const entering = reducedMotion
    ? undefined
    : new Keyframe({
        0: {
          transform: [{ scale: scaleFactor }],
          opacity: 1,
        },
        20: {
          opacity: 1,
        },
        70: {
          opacity: 0,
          easing: Easing.elastic(0.7),
        },
        100: {
          opacity: 0,
          transform: [{ scale: 1 }],
          easing: Easing.elastic(0.7),
        },
      })
        .duration(DURATION)
        .withCallback((finished: boolean) => {
          'worklet';
          if (finished) {
            scheduleOnRN(setVisible, false);
          }
        });

  return (
    <TwAnimatedView
      entering={entering}
      className="absolute inset-0 justify-center items-center z-[200]"
      style={{ backgroundColor }}
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
    <TwView className="justify-center items-center w-32 h-32 z-[100]">
      <Image style={styles.image} source={EXPO_LOGO} alt="" />
    </TwView>
  );
}

const styles = StyleSheet.create({
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
});
