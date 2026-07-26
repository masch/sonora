import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
// react-doctor-disable-next-line react-doctor/rn-no-legacy-expo-packages — actively maintained in SDK 56, backgroundImage CSS is experimental
import { LinearGradient } from 'expo-linear-gradient';

import { LOGO_GLOW, EXPO_LOGO } from '@/constants/images';
import { SPLASH_COLORS } from '@/constants/theme';
import { TwText, TwView } from '@/tw';

const DURATION = 2000;

// react-doctor-disable-next-line deslop/unused-export — false positive: used in _layout.tsx via @/ alias
export function AnimatedSplashOverlay() {
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(true);

  const versionText = useMemo(() => {
    const appVersion = Application.nativeApplicationVersion;
    const buildNumber = Application.nativeBuildVersion;
    if (!appVersion || !buildNumber) return null;
    return `${appVersion} (${buildNumber})`;
  }, []);

  const isProduction = Constants.expoConfig?.extra?.isProduction === true;
  const backgroundColor = isProduction ? SPLASH_COLORS.production : SPLASH_COLORS.staging;

  if (!visible) return null;

  const scaleFactor = height / 90;

  const splashKeyframe = new Keyframe({
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
  });

  return (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={[styles.backgroundSolidColor, { backgroundColor }]}
    >
      {versionText && (
        <TwText className="absolute self-center bottom-12 text-xs font-semibold text-white tracking-[0.5px]">
          {versionText}
        </TwText>
      )}
    </Animated.View>
  );
}

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

// react-doctor-disable-next-line deslop/unused-export — false positive: used externally via @/ alias
export function AnimatedIcon() {
  const { height } = useWindowDimensions();

  const keyframe = new Keyframe({
    0: {
      transform: [{ scale: height / 90 }],
    },
    100: {
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  return (
    <TwView className="justify-center items-center w-32 h-32 z-[100]">
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={LOGO_GLOW} alt="" />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.backgroundContainer}>
        <LinearGradient colors={['#3C9FFE', '#0274DF']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={EXPO_LOGO} alt="Sonora logo" />
      </Animated.View>
    </TwView>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  backgroundContainer: {
    borderRadius: 40,
    overflow: 'hidden',
    width: 128,
    height: 128,
    position: 'absolute',
  },
  backgroundSolidColor: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#208AEF',
    zIndex: 200,
  },
});
