import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/i18n';
import type { CurvePoint } from '@/services/analytics/reelInsights';
import { formatCompact } from '@/utils/format';

import { smoothPath } from './chartUtils';

const PADDING = { top: 14, bottom: 24, left: 44, right: 10 };

interface ComparisonChartProps {
  /** This post's cumulative curve; may stop before the end of the window. */
  primary: readonly CurvePoint[];
  /** The "typical post" curve, drawn dashed across the whole window. */
  secondary: readonly CurvePoint[];
  /** X domain, in the same unit as the points' `t`. */
  domain: number;
  /** Start · middle · end labels under the axis. */
  labels: [string, string, string];
  primaryLabel: string;
  secondaryLabel: string;
  height?: number;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / exp;
  const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10;
  return step * exp;
}

/**
 * Instagram's "Zaman içindeki görüntülemeler": this post's cumulative views as a solid
 * magenta line against a typical post as a dashed grey one, with three x labels and a
 * legend underneath. The solid line ends where the post's own age ends, which is what
 * makes a fresh post read as "still climbing".
 */
export function ComparisonChart({ primary, secondary, domain, labels, primaryLabel, secondaryLabel, height = 200 }: ComparisonChartProps) {
  const { colors } = useTheme();
  const language = useLanguage();
  const [width, setWidth] = useState(0);

  const max = useMemo(() => niceMax(Math.max(1, ...primary.map((p) => p.value), ...secondary.map((p) => p.value))), [primary, secondary]);
  const ticks = useMemo(() => [0, max / 2, max], [max]);

  const innerW = Math.max(1, width - PADDING.left - PADDING.right);
  const innerH = Math.max(1, height - PADDING.top - PADDING.bottom);
  const xFor = (t: number) => PADDING.left + (domain > 0 ? Math.min(1, t / domain) : 0) * innerW;
  const yFor = (value: number) => PADDING.top + innerH - (value / max) * innerH;
  const toPath = (points: readonly CurvePoint[]) => smoothPath(points.map((p) => ({ x: xFor(p.t), y: yFor(p.value) })), 0.16);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={primaryLabel}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            {ticks.map((tick, i) => (
              <Line key={i} x1={PADDING.left} x2={width - PADDING.right} y1={yFor(tick)} y2={yFor(tick)} stroke={colors.chartGrid} strokeWidth={1} />
            ))}
            <Path d={toPath(secondary)} stroke={colors.chartSecondary} strokeWidth={3} strokeDasharray="9 7" fill="none" strokeLinecap="round" />
            <Path d={toPath(primary)} stroke={colors.chartLine} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <View style={[styles.yAxis, { height: height - PADDING.bottom }]} pointerEvents="none">
            {ticks.map((tick, i) => (
              <Text key={i} variant="caption" color="secondary" style={{ position: 'absolute', top: yFor(tick) - 9, left: 0 }}>
                {tick === 0 ? '0' : formatCompact(Math.round(tick), language)}
              </Text>
            ))}
          </View>
          <View style={[styles.xAxis, { left: PADDING.left, right: PADDING.right }]} pointerEvents="none">
            {labels.map((label, i) => (
              <Text key={`${label}-${i}`} variant="caption" color="secondary">
                {label}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View style={{ height }} />
      )}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.chartLine }]} />
          <Text variant="caption">{primaryLabel}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.chartSecondary }]} />
          <Text variant="caption" color="secondary">
            {secondaryLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  yAxis: { position: 'absolute', left: 0, top: 0, width: PADDING.left - 6 },
  xAxis: { position: 'absolute', bottom: 26, flexDirection: 'row', justifyContent: 'space-between' },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});
