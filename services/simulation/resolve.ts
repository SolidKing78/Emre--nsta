import type { MetricKey } from '@/types/app';

import { applyGrowth } from './growth';

/**
 * Pure display-value resolver.
 *
 *   simulationMode === false → displayValue = realValue
 *   simulationMode === true  → displayValue = overrideValue            (explicit edit wins)
 *                                           ?? realValue × growth      (scenario growth rate)
 *                                           ?? realValue
 *
 * The real value is never mutated; the overlay only decides what is displayed.
 */
export interface ResolvedMetric {
  realValue: number;
  overrideValue?: number;
  displayValue: number;
  isSimulated: boolean;
}

export interface GrowthContext {
  /** Scenario growth rate in percent (0 = none). */
  percent: number;
  metric: MetricKey;
  /** Stable seed for per-post deviation (omit for account-level metrics). */
  seed?: string;
}

export function resolveMetric(
  realValue: number,
  overrideValue: number | undefined,
  simulationEnabled: boolean,
  growth?: GrowthContext,
): ResolvedMetric {
  if (!simulationEnabled) {
    return { realValue, overrideValue, displayValue: realValue, isSimulated: false };
  }
  if (overrideValue !== undefined && Number.isFinite(overrideValue)) {
    return { realValue, overrideValue, displayValue: overrideValue, isSimulated: overrideValue !== realValue };
  }
  if (growth && growth.percent !== 0) {
    const grown = applyGrowth(realValue, growth.metric, growth.percent, growth.seed);
    return { realValue, overrideValue, displayValue: grown, isSimulated: grown !== realValue };
  }
  return { realValue, overrideValue, displayValue: realValue, isSimulated: false };
}

export function applyFactor(realValue: number, factor: number): number {
  return Math.max(0, Math.round(realValue * factor));
}
