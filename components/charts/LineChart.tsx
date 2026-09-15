import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { Text } from '@/components/common/Text';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/i18n';
import type { SeriesPoint } from '@/types/app';
import { formatShortDate } from '@/utils/date';
import { formatCompact } from '@/utils/format';

import { nearestIndex, polylineLength, scalePoints } from './chartUtils';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface LineChartProps {
  data: readonly SeriesPoint[];
  height?: number;
  color?: string;
  showAxis?: boolean;
  formatValue?: (value: number) => string;
  /** Custom label for a point (defaults to a short date). */
  formatLabel?: (date: string) => string;
  /** Called when the user scrubs; -1 when released. */
  onScrub?: (index: number) => void;
  /** Allow negative values (follower growth). */
  allowNegative?: boolean;
}

const PADDING = { top: 12, bottom: 26, left: 34, right: 10 };
const TOOLTIP_SPACE = 40;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10;
  return step * exp;
}

/**
 * Instagram Insights style line chart: straight magenta line, left axis ticks,
 * light gridlines, dashed scrub line and a value/date bubble on touch.
 */
export function LineChart({ data, height = 220, color, showAxis = true, formatValue, formatLabel, onScrub, allowNegative = false }: LineChartProps) {
  const { colors } = useTheme();
  const language = useLanguage();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(-1);
  const stroke = color ?? colors.chartLine;

  const domain = useMemo(() => {
    const values = data.map((d) => d.value);
    const rawMax = Math.max(0, ...values);
    const rawMin = allowNegative ? Math.min(0, ...values) : 0;
    const max = niceMax(rawMax);
    const min = allowNegative ? -niceMax(Math.abs(rawMin)) : 0;
    return { min: rawMin < 0 ? min : 0, max: max === 0 ? 1 : max };
  }, [data, allowNegative]);

  const { points } = useMemo(() => scalePoints(data, width, height, PADDING, domain), [data, width, height, domain]);
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);
  const length = useMemo(() => polylineLength(points), [points]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [linePath, progress]);

  const animatedLine = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value),
  }));

  const select = (index: number) => {
    setActive((prev) => {
      if (prev !== index && index >= 0) triggerHaptic('selection');
      return index;
    });
    onScrub?.(index);
  };

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .activateAfterLongPress(0)
        .onBegin((e) => {
          runOnJS(select)(nearestIndex(points, e.x));
        })
        .onUpdate((e) => {
          runOnJS(select)(nearestIndex(points, e.x));
        })
        .onFinalize(() => {
          runOnJS(select)(-1);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points],
  );

  const ticks = useMemo(() => {
    const mid = domain.min < 0 ? 0 : domain.max / 2;
    return [domain.min, mid, domain.max];
  }, [domain]);
  const yFor = (value: number) => PADDING.top + (height - PADDING.top - PADDING.bottom) * (1 - (value - domain.min) / (domain.max - domain.min || 1));

  const activePoint = active >= 0 ? points[active] : undefined;
  const activeDatum = active >= 0 ? data[active] : undefined;
  const fmt = formatValue ?? ((v: number) => formatCompact(v, language));
  const label = formatLabel ?? ((d: string) => formatShortDate(d, language));

  const tooltipWidth = 96;
  const tooltipLeft = activePoint ? Math.min(Math.max(activePoint.x - tooltipWidth / 2, 0), Math.max(0, width - tooltipWidth)) : 0;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const xLabels = useMemo(() => {
    if (data.length === 0) return [];
    const first = data[0];
    const mid = data[Math.floor(data.length / 2)];
    const last = data[data.length - 1];
    return [first, mid, last].filter((d): d is SeriesPoint => Boolean(d));
  }, [data]);

  return (
    <View onLayout={onLayout} style={{ height: height + TOOLTIP_SPACE, paddingTop: TOOLTIP_SPACE }} accessible accessibilityLabel="chart">
      {width > 0 && data.length > 0 ? (
        <GestureDetector gesture={gesture}>
          <View>
            <Svg width={width} height={height}>
              {showAxis
                ? ticks.map((tick, i) => (
                    <Line key={i} x1={PADDING.left} x2={width - PADDING.right} y1={yFor(tick)} y2={yFor(tick)} stroke={colors.chartGrid} strokeWidth={1} />
                  ))
                : null}
              {activePoint ? (
                <Line x1={activePoint.x} x2={activePoint.x} y1={PADDING.top - 4} y2={height - PADDING.bottom} stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="4 4" />
              ) : null}
              <AnimatedPath
                d={linePath}
                stroke={stroke}
                strokeWidth={3.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${length} ${length}`}
                animatedProps={animatedLine}
              />
            </Svg>
            {showAxis ? (
              <>
                <View style={[styles.yAxis, { top: 0, bottom: PADDING.bottom }]} pointerEvents="none">
                  {[...ticks].reverse().map((tick, i) => (
                    <Text key={`${tick}-${i}`} variant="caption" color="secondary" style={{ position: 'absolute', top: yFor(tick) - 9, left: 0 }}>
                      {fmt(tick)}
                    </Text>
                  ))}
                </View>
                <View style={[styles.xAxis, { left: PADDING.left, right: PADDING.right }]} pointerEvents="none">
                  {xLabels.map((d, i) => (
                    <Text key={`${d.date}-${i}`} variant="caption" color="secondary">
                      {label(d.date)}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}
            {activeDatum ? (
              <View style={[styles.tooltip, { left: tooltipLeft, width: tooltipWidth, backgroundColor: colors.sheet, borderColor: colors.borderStrong }]} pointerEvents="none">
                <Text variant="bodyStrong">{fmt(activeDatum.value)}</Text>
                <Text variant="caption" color="secondary">
                  {label(activeDatum.date)}
                </Text>
              </View>
            ) : null}
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  yAxis: { position: 'absolute', left: 0, width: PADDING.left - 6 },
  xAxis: { position: 'absolute', bottom: 0, flexDirection: 'row', justifyContent: 'space-between' },
  tooltip: {
    position: 'absolute',
    top: -TOOLTIP_SPACE + 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
