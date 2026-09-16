import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Text } from '@/components/common/Text';
import { useTheme } from '@/hooks/useTheme';
import { formatClock } from '@/services/analytics/reelInsights';

import { smoothPath } from './chartUtils';

const PADDING = { top: 14, bottom: 22, left: 40, right: 8 };

interface PlaybackChartProps {
  /** Percent values, evenly spaced across the clip. */
  values: readonly number[];
  /** Top of the y axis, in percent. */
  max: number;
  durationSec: number;
  height?: number;
  /**
   * Rounded (how long people watched) or straight-edged (when people interacted —
   * Instagram draws those as spikes, and smoothing would round them away).
   */
  smooth?: boolean;
}

/**
 * A curve across a reel's playback time: "İnsanların Reels videonu izleme süresi" and
 * "İnsanlar Reels videonu gördüğünde". Y axis in percent, X axis from 0:00 to the clip's
 * length.
 */
export function PlaybackChart({ values, max, durationSec, height = 170, smooth = true }: PlaybackChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const top = Math.max(1, max);
  const ticks = [0, top / 2, top];
  const innerW = Math.max(1, width - PADDING.left - PADDING.right);
  const innerH = Math.max(1, height - PADDING.top - PADDING.bottom);
  const n = Math.max(1, values.length - 1);
  const points = values.map((value, i) => ({
    x: PADDING.left + (i / n) * innerW,
    y: PADDING.top + innerH - (Math.min(top, Math.max(0, value)) / top) * innerH,
  }));
  const path = smooth
    ? smoothPath(points, 0.14)
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel="chart">
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            {ticks.map((tick, i) => (
              <Line
                key={i}
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={PADDING.top + innerH - (tick / top) * innerH}
                y2={PADDING.top + innerH - (tick / top) * innerH}
                stroke={colors.chartGrid}
                strokeWidth={1}
              />
            ))}
            <Path d={path} stroke={colors.chartLine} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <View style={[styles.yAxis, { height: height - PADDING.bottom }]} pointerEvents="none">
            {ticks.map((tick, i) => (
              <Text key={i} variant="caption" color="secondary" style={{ position: 'absolute', top: PADDING.top + innerH - (tick / top) * innerH - 9, left: 0 }}>
                {tick === 0 ? '0' : `${Math.round(tick)}%`}
              </Text>
            ))}
          </View>
          <View style={[styles.xAxis, { left: PADDING.left, right: PADDING.right }]} pointerEvents="none">
            <Text variant="caption" color="secondary">
              0:00
            </Text>
            <Text variant="caption" color="secondary">
              {formatClock(durationSec)}
            </Text>
          </View>
        </>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  yAxis: { position: 'absolute', left: 0, top: 0, width: PADDING.left - 6 },
  xAxis: { position: 'absolute', bottom: 2, flexDirection: 'row', justifyContent: 'space-between' },
});
