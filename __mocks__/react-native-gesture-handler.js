/* eslint-disable @typescript-eslint/no-require-imports */
const { View, ScrollView, Pressable, FlatList } = require('react-native');

/**
 * Gesture Handler's detector runs through Reanimated's worklet plumbing, which jest has
 * no host for. Under test a detector just renders what it wraps, and a gesture builder
 * only has to accept the chained configuration calls.
 */

const builder = {};
const CHAINABLE = [
  'enabled',
  'onBegin',
  'onStart',
  'onUpdate',
  'onEnd',
  'onFinalize',
  'onTouchesDown',
  'onTouchesUp',
  'minDistance',
  'minPointers',
  'maxPointers',
  'numberOfTaps',
  'activateAfterLongPress',
  'shouldCancelWhenOutside',
  'failOffsetX',
  'failOffsetY',
  'activeOffsetX',
  'activeOffsetY',
  'simultaneousWithExternalGesture',
  'requireExternalGestureToFail',
  'hitSlop',
  'runOnJS',
];
for (const name of CHAINABLE) builder[name] = () => builder;

module.exports = {
  __esModule: true,
  GestureHandlerRootView: View,
  GestureDetector: ({ children }) => children,
  Gesture: {
    Pan: () => builder,
    Tap: () => builder,
    LongPress: () => builder,
    Native: () => builder,
    Simultaneous: () => builder,
    Race: () => builder,
    Exclusive: () => builder,
  },
  ScrollView,
  FlatList,
  TouchableOpacity: Pressable,
  RectButton: Pressable,
  BaseButton: Pressable,
  Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
  State: { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 },
  gestureHandlerRootHOC: (Component) => Component,
};
