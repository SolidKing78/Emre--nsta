/* eslint-disable @typescript-eslint/no-require-imports */
const { View, Text, ScrollView, Image } = require('react-native');

/**
 * Reanimated 4 boots a native worklet runtime that jest has no host for, so importing the
 * real package throws before a single component renders. Components under test only need
 * its hooks and animated views to exist and behave synchronously.
 *
 * Lives in the root `__mocks__` so every suite picks it up without its own jest.mock.
 */

const passthrough = (value) => value;

function useSharedValue(initial) {
  const ref = {
    value: initial,
    get: () => ref.value,
    set: (next) => {
      ref.value = typeof next === 'function' ? next(ref.value) : next;
    },
    modify: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  };
  return ref;
}

const Animated = {
  View,
  Text,
  ScrollView,
  Image,
  createAnimatedComponent: (Component) => Component,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue,
  useAnimatedStyle: (fn) => (typeof fn === 'function' ? fn() : {}),
  useAnimatedProps: (fn) => (typeof fn === 'function' ? fn() : {}),
  useDerivedValue: (fn) => useSharedValue(typeof fn === 'function' ? fn() : undefined),
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: () => () => undefined,
  useEvent: () => () => undefined,
  useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  useComposedEventHandler: () => () => undefined,
  withTiming: (value, _config, callback) => {
    if (typeof callback === 'function') callback(true);
    return value;
  },
  withSpring: (value, _config, callback) => {
    if (typeof callback === 'function') callback(true);
    return value;
  },
  withDelay: (_delay, value) => value,
  withSequence: (...values) => values[values.length - 1],
  withRepeat: passthrough,
  cancelAnimation: () => undefined,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (value) => value,
  interpolateColor: () => '#000000',
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing: {
    linear: (t) => t,
    ease: (t) => t,
    quad: (t) => t,
    cubic: (t) => t,
    bezier: () => (t) => t,
    in: (fn) => fn ?? ((t) => t),
    out: (fn) => fn ?? ((t) => t),
    inOut: (fn) => fn ?? ((t) => t),
  },
  FadeIn: { duration: () => ({}), delay: () => ({}) },
  FadeOut: { duration: () => ({}), delay: () => ({}) },
  Layout: { duration: () => ({}) },
};
