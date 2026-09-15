import React, { useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/i18n';
import { formatCompact, formatNumber } from '@/utils/format';

import { Text, type TextProps } from './Text';

interface StatCounterProps extends Omit<TextProps, 'children'> {
  value: number;
  /** compact → 12.5K, full → 12,483 */
  format?: 'compact' | 'full' | 'percent';
  durationMs?: number;
  suffix?: string;
  decimals?: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animated number: counts smoothly from the previous value to the new one
 * (e.g. 12,482 → 50,000 when a simulation preset is applied).
 */
export function StatCounter({ value, format = 'compact', durationMs = 650, suffix = '', decimals = 1, ...textProps }: StatCounterProps) {
  const language = useLanguage();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      const next = from + (to - from) * easeOutCubic(progress);
      setDisplay(next);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      fromRef.current = to;
    };
  }, [value, durationMs]);

  const text =
    format === 'compact'
      ? formatCompact(display, language)
      : format === 'percent'
        ? `${display.toFixed(decimals).replace('.', language === 'tr' ? ',' : '.')}%`
        : formatNumber(display, language);

  return (
    <Text {...textProps} accessibilityLabel={`${text}${suffix}`}>
      {text}
      {suffix}
    </Text>
  );
}
