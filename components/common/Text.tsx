import React, { useMemo } from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { fontStyleForWeight } from '@/constants/fonts';
import { letterSpacingFor, typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export type TextVariant = keyof typeof typography;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success' | 'link' | 'simulation' | 'onPrimary';
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
}

/**
 * Every piece of text in the app goes through here, which is what keeps the typeface
 * consistent: a `fontWeight` — from the variant, the `weight` prop or a caller's style —
 * is turned into the matching Inter cut, because Android picks the cut by family name and
 * would otherwise render everything Regular. Tracking follows the final font size so an
 * ad-hoc `fontSize` still gets Instagram's spacing.
 */
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

  const base = typography[variant];
  const resolved = useMemo(() => {
    const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
    // A caller that names its own family knows what it wants (the wordmark, monospace traces).
    const font = flat.fontFamily
      ? { fontFamily: flat.fontFamily, fontWeight: flat.fontWeight }
      : fontStyleForWeight(weight ?? flat.fontWeight ?? base.fontWeight);
    const size = typeof flat.fontSize === 'number' ? flat.fontSize : base.fontSize;
    const letterSpacing = typeof flat.letterSpacing === 'number' ? flat.letterSpacing : letterSpacingFor(size);
    return { ...font, letterSpacing };
  }, [style, weight, base]);

  return <RNText {...rest} maxFontSizeMultiplier={1.4} style={[base, { color: colorValue }, align ? { textAlign: align } : null, styles.base, style, resolved]} />;
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
