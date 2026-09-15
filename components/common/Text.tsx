import React from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export type TextVariant = keyof typeof typography;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success' | 'link' | 'simulation' | 'onPrimary';
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'primary', weight, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const colorValue = {
    primary: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: colors.primary,
    danger: colors.danger,
    success: colors.success,
    link: colors.link,
    simulation: colors.simulation,
    onPrimary: colors.onPrimary,
  }[color];
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.4}
      style={[
        typography[variant],
        { color: colorValue },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        styles.base,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
