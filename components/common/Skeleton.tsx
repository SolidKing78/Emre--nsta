import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { radius as radiusTokens, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Pulsing placeholder block. */
export function Skeleton({ width = '100%', height = 16, radius = radiusTokens.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeleton }, animated, style]} />;
}

export function PostSkeleton() {
  return (
    <View style={styles.post}>
      <View style={styles.row}>
        <Skeleton width={32} height={32} radius={16} />
        <Skeleton width={120} height={12} style={{ marginLeft: spacing.md }} />
      </View>
      <Skeleton width="100%" height={380} radius={0} style={{ marginTop: spacing.md }} />
      <View style={[styles.row, { marginTop: spacing.md }]}>
        <Skeleton width={24} height={24} radius={12} />
        <Skeleton width={24} height={24} radius={12} style={{ marginLeft: spacing.lg }} />
        <Skeleton width={24} height={24} radius={12} style={{ marginLeft: spacing.lg }} />
      </View>
      <Skeleton width={90} height={12} style={{ marginTop: spacing.md }} />
      <Skeleton width="80%" height={12} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

export function GridSkeleton({ columns = 3, rows = 4, gap = 1.5 }: { columns?: number; rows?: number; gap?: number }) {
  const cells = Array.from({ length: columns * rows });
  return (
    <View style={[styles.grid, { gap }]}>
      {cells.map((_, i) => (
        <View key={i} style={{ width: `${100 / columns - 0.4}%`, aspectRatio: 3 / 4 }}>
          <Skeleton width="100%" height={0} radius={0} style={{ flex: 1, height: undefined }} />
        </View>
      ))}
    </View>
  );
}

export function MetricCardSkeleton() {
  return (
    <View style={styles.metric}>
      <Skeleton width={80} height={12} />
      <Skeleton width={120} height={28} style={{ marginTop: spacing.md }} />
      <Skeleton width={60} height={12} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  post: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { padding: spacing.lg },
});
