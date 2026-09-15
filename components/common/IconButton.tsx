import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { hitSlop, touch } from '@/constants/theme';

import { PressableScale } from './PressableScale';

interface IconButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  disabled?: boolean;
}

export function IconButton({ children, onPress, onLongPress, accessibilityLabel, size = touch.minTarget, style, haptic = true, disabled }: IconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={hitSlop}
      haptic={haptic}
      disabled={disabled}
      scaleTo={0.88}
      style={[styles.root, { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : 1 }, style]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
});
