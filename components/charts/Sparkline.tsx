import React, { useMemo } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { SeriesPoint } from '@/types/app';

import { areaPath, scalePoints, smoothPath } from './chartUtils';

interface SparklineProps {
  data: readonly SeriesPoint[];
  width?: number;
  height?: number;
  color: string;
  id?: string;
}

/** Tiny trend line for KPI cards. Purely decorative (no interaction). */
export function Sparkline({ data, width = 72, height = 28, color, id = 'spark' }: SparklineProps) {
  const { line, area } = useMemo(() => {
    if (data.length < 2) return { line: '', area: '' };
    const { points } = scalePoints(data, width, height, { top: 3, bottom: 2, left: 1, right: 1 });
    return { line: smoothPath(points, 0.18), area: areaPath(points, height, 0.18) };
  }, [data, width, height]);
  if (!line) return null;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.3} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${id})`} />
      <Path d={line} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
