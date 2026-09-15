import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';

interface ScreenProps extends ViewProps {
  /** Safe-area edges to pad. Defaults to top only (tab bar handles bottom). */
  edges?: Edge[];
  background?: 'default' | 'elevated';
}

export function Screen({ edges = ['top'], background = 'default', style, children, ...rest }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
  return (
    <View
      {...rest}
      style={[styles.root, { backgroundColor: background === 'elevated' ? colors.surfaceElevated : colors.background }, padding, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
