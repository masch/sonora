import { View, Text, Image, ScrollView } from 'react-native';

const Reanimated: Record<string, unknown> = {
  View,
  Text,
  Image,
  ScrollView,
  createAnimatedComponent: (component: unknown) => component,
  Keyframe: class {
    constructor(def: Record<string, unknown>) { Object.assign(this, def); }
    duration() { return this; }
    delay() { return this; }
    withCallback() { return this; }
  },
  useSharedValue: (init: unknown) => ({ value: init }),
  useAnimatedStyle: (callback: () => unknown) => callback(),
  useDerivedValue: (callback: () => unknown) => ({ value: callback() }),
  withTiming: (toValue: unknown) => toValue,
  withSpring: (toValue: unknown) => toValue,
  withDecay: () => ({}),
  Easing: {
    linear: () => ({}),
    ease: () => ({}),
    in: () => ({}),
    out: () => ({}),
    inOut: () => ({}),
    elastic: () => ({}),
  },
  runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
  runOnUI: (fn: (...args: unknown[]) => unknown) => fn,
  interpolate: (value: number, inputRange: number[], outputRange: number[]) =>
    outputRange[0] ?? value,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  default: {
    View,
    Text,
    Image,
    ScrollView,
    createAnimatedComponent: (component: unknown) => component,
  },
};

export default Reanimated;
module.exports = Reanimated;

