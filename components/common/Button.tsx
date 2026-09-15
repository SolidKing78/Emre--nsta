import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, touch } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'simulation';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  haptic?: boolean;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, icon, style, accessibilityLabel, haptic = true }: ButtonProps) {
  const { colors } = useTheme();
  const background = {
    primary: colors.primary,
    secondary: colors.secondaryButton,
    ghost: 'transparent',
    danger: colors.danger,
    simulation: colors.simulation,
  }[variant];
  const textColor = variant === 'secondary' ? colors.text : variant === 'ghost' ? colors.primary : colors.onPrimary;
  const height = size === 'sm' ? 32 : size === 'lg' ? touch.minTarget + 4 : 36;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic}
      scaleTo={0.97}
      style={[styles.root, { backgroundColor: background, height, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text variant={size === 'sm' ? 'captionStrong' : 'bodyStrong'} style={{ color: textColor }} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: spacing.sm },
});
