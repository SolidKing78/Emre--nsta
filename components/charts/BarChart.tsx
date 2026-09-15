import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { Text } from '@/components/common/Text';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/i18n';
import { formatCompact } from '@/utils/format';

export interface BarDatum {
  label: string;
  value: number;
  /** Optional per-bar color */
  color?: string;
  /** Tooltip text override */
  detail?: string;
}

interface BarChartProps {
  data: readonly BarDatum[];
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
  /** Show every n-th label to avoid clutter. */
  labelEvery?: number;
  simulated?: boolean;
}

const PADDING = { top: 18, bottom: 20 };

export function BarChart({ data, height = 160, color, formatValue, labelEvery = 1, simulated }: BarChartProps) {
  const { colors } = useTheme();
  const language = useLanguage();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(-1);
  const fill = color ?? (simulated ? colors.simulation : colors.chart);
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  const fmt = formatValue ?? ((v: number) => formatCompact(v, language));

  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = 0;
    grow.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [data, grow]);
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));

  const innerH = height - PADDING.top - PADDING.bottom;
  const n = Math.max(1, data.length);
  const slot = width / n;
  const barW = Math.max(4, Math.min(28, slot * 0.62));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const activeDatum = active >= 0 ? data[active] : undefined;
  const tooltipWidth = 120;
  const tooltipLeft = activeDatum ? Math.min(Math.max(active * slot + slot / 2 - tooltipWidth / 2, 0), Math.max(0, width - tooltipWidth)) : 0;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <>
          <Animated.View style={[{ height: innerH + PADDING.top, transformOrigin: 'bottom' }, growStyle]}>
            <Svg width={width} height={innerH + PADDING.top}>
              {data.map((d, i) => {
                const h = Math.max(2, (d.value / max) * innerH);
                const x = i * slot + (slot - barW) / 2;
                const y = PADDING.top + innerH - h;
                const isActive = i === active;
                return (
                  <Rect
                    key={`${d.label}-${i}`}
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={Math.min(6, barW / 2)}
                    fill={d.color ?? fill}
                    opacity={active === -1 || isActive ? 1 : 0.35}
                  />
                );
              })}
            </Svg>
          </Animated.View>
          <View style={[StyleSheet.absoluteFill, styles.touchRow]}>
            {data.map((d, i) => (
              <Pressable
                key={`${d.label}-touch-${i}`}
                style={{ width: slot }}
                accessibilityRole="button"
                accessibilityLabel={`${d.label} ${fmt(d.value)}`}
                onPressIn={() => {
                  triggerHaptic('selection');
                  setActive(i);
                }}
                onPressOut={() => setActive(-1)}
              />
            ))}
          </View>
          <View style={[styles.labels, { bottom: 0 }]} pointerEvents="none">
            {data.map((d, i) => (
              <View key={`${d.label}-l-${i}`} style={{ width: slot, alignItems: 'center' }}>
                {i % labelEvery === 0 ? (
                  <Text variant="small" color="tertiary" numberOfLines={1}>
                    {d.label}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
          {activeDatum ? (
            <View style={[styles.tooltip, { left: tooltipLeft, width: tooltipWidth, backgroundColor: colors.text }]} pointerEvents="none">
              <Text variant="small" style={{ color: colors.background, opacity: 0.8 }} numberOfLines={1}>
                {activeDatum.detail ?? activeDatum.label}
              </Text>
              <Text variant="captionStrong" style={{ color: colors.background }}>
                {fmt(activeDatum.value)}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  touchRow: { flexDirection: 'row' },
  labels: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  tooltip: { position: 'absolute', top: -8, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, alignItems: 'center' },
});
