import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: readonly DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

function Arc({ slice, offset, total, radius, circumference, thickness }: { slice: DonutSlice; offset: number; total: number; radius: number; circumference: number; thickness: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [progress, slice.value]);
  const fraction = total > 0 ? slice.value / total : 0;
  const animatedProps = useAnimatedProps(() => {
    const len = circumference * fraction * progress.value;
    return { strokeDasharray: `${len} ${circumference - len}` };
  });
  return (
    <AnimatedCircle
      cx={0}
      cy={0}
      r={radius}
      fill="none"
      stroke={slice.color}
      strokeWidth={thickness}
      strokeLinecap="butt"
      strokeDashoffset={-offset}
      animatedProps={animatedProps}
    />
  );
}

export function DonutChart({ slices, size = 140, thickness = 16, centerLabel, centerValue }: DonutChartProps) {
  const { colors } = useTheme();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const arcs = slices.reduce<{ slice: DonutSlice; start: number }[]>((acc, slice) => {
    const previous = acc[acc.length - 1];
    const start = previous ? previous.start + circumference * (total > 0 ? previous.slice.value / total : 0) : 0;
    acc.push({ slice, start });
    return acc;
  }, []);
  return (
    <View style={styles.root}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G x={size / 2} y={size / 2} rotation={-90}>
            <Circle cx={0} cy={0} r={radius} fill="none" stroke={colors.chartGrid} strokeWidth={thickness} />
            {arcs.map(({ slice, start }, i) => (
              <Arc key={`${slice.label}-${i}`} slice={slice} offset={start} total={total} radius={radius} circumference={circumference} thickness={thickness} />
            ))}
          </G>
        </Svg>
        <View style={styles.center} pointerEvents="none">
          {centerValue ? (
            <Text variant="title" weight="700">
              {centerValue}
            </Text>
          ) : null}
          {centerLabel ? (
            <Text variant="small" color="secondary">
              {centerLabel}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.legend}>
        {slices.map((slice, i) => (
          <View key={`${slice.label}-legend-${i}`} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <Text variant="caption" color="secondary" style={styles.legendLabel} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text variant="captionStrong">{total > 0 ? `${Math.round((slice.value / total) * 100)}%` : '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  legend: { flex: 1, marginLeft: spacing.xl },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  legendLabel: { flex: 1, marginRight: spacing.sm },
});
