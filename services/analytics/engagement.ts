import type { EngagementFormula } from '@/store/settingsStore';
import type { AppMetric } from '@/types/app';
import { metricValue } from '@/types/app';

export interface EngagementInput {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  followers: number;
}

/**
 * Engagement rate in percent.
 *   reach:     (likes + comments + saves + shares) / reach × 100
 *   followers: (likes + comments + saves + shares) / followers × 100
 * Returns null when the denominator is missing so the UI can show "—".
 */
export function engagementRate(input: EngagementInput, formula: EngagementFormula): number | null {
  const numerator = input.likes + input.comments + input.saves + input.shares;
  const denominator = formula === 'reach' ? input.reach : input.followers;
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function engagementFromMetrics(
  metrics: readonly AppMetric[],
  followers: number,
  formula: EngagementFormula,
): number | null {
  return engagementRate(
    {
      likes: metricValue(metrics, 'likes'),
      comments: metricValue(metrics, 'comments'),
      saves: metricValue(metrics, 'saves'),
      shares: metricValue(metrics, 'shares'),
      reach: metricValue(metrics, 'reach'),
      followers,
    },
    formula,
  );
}

export function totalInteractions(metrics: readonly AppMetric[]): number {
  const explicit = metrics.find((m) => m.key === 'interactions');
  if (explicit) return explicit.value;
  return metricValue(metrics, 'likes') + metricValue(metrics, 'comments') + metricValue(metrics, 'saves') + metricValue(metrics, 'shares');
}
