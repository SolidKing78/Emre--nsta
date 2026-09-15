import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { triggerHaptic } from '@/hooks/useHaptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean | 'light' | 'medium' | 'selection';
}

/** Instagram-style press feedback: subtle spring scale + optional haptic. */
export function PressableScale({ style, scaleTo = 0.96, haptic = false, onPressIn, onPressOut, onPress, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const handleIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (e) => {
      scale.set(withSpring(scaleTo, { damping: 18, stiffness: 320 }));
      onPressIn?.(e);
    },
    [scale, scaleTo, onPressIn],
  );
  const handleOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (e) => {
      scale.set(withSpring(1, { damping: 16, stiffness: 260 }));
      onPressOut?.(e);
    },
    [scale, onPressOut],
  );
  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (e) => {
      if (haptic) triggerHaptic(haptic === true ? 'light' : haptic);
      onPress?.(e);
    },
    [haptic, onPress],
  );

  return <AnimatedPressable {...rest} onPress={handlePress} onPressIn={handleIn} onPressOut={handleOut} style={[animated, style]} />;
}
