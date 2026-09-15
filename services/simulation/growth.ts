import type { MetricKey } from '@/types/app';
import { hashString } from '@/utils/random';

/**
 * Percentage-based growth model.
 *
 * One growth rate (e.g. +35%) drives every metric the way it would move on a real
 * Instagram professional dashboard: views/likes move 1:1, saves and new followers
 * react a bit stronger, reach slightly weaker, total followers much slower, and
 * counts that cannot grow (following, post count) stay put. Per-post values get a
 * small deterministic deviation so posts do not all scale by the exact same number.
 */
export const GROWTH_ELASTICITY: Record<MetricKey, number> = {
  views: 1,
  reach: 0.85,
  interactions: 1.1,
  likes: 1,
  comments: 0.9,
  saves: 1.15,
  shares: 1.05,
  followers: 0.3,
  following: 0,
  media_count: 0,
  profile_visits: 0.6,
  website_clicks: 0.5,
  new_followers: 1.3,
  accounts_engaged: 0.9,
  avg_watch_time: 0.15,
  replays: 1,
  follows_from_post: 1.2,
};

export const GROWTH_MIN = -90;
export const GROWTH_MAX = 1000;

export const GROWTH_RATE_PRESETS: readonly number[] = [10, 25, 50, 100, 200, 500];

/** Deterministic deviation in [-0.04, 0.04], scaled down for small growth rates. */
function deviation(seed: string, percent: number): number {
  const unit = (hashString(seed) % 10_000) / 10_000; // 0..1
  const strength = Math.min(1, Math.abs(percent) / 25);
  return (unit - 0.5) * 0.08 * strength;
}

export function growthFactor(metric: MetricKey, percent: number, seed?: string): number {
  if (!Number.isFinite(percent) || percent === 0) return 1;
  const elasticity = GROWTH_ELASTICITY[metric] ?? 1;
  if (elasticity === 0) return 1;
  const base = 1 + (percent / 100) * elasticity;
  const jitter = seed ? deviation(seed, percent) : 0;
  return Math.max(0, base * (1 + jitter));
}

export function applyGrowth(realValue: number, metric: MetricKey, percent: number, seed?: string): number {
  if (!Number.isFinite(percent) || percent === 0) return realValue;
  const grown = realValue * growthFactor(metric, percent, seed);
  // Watch time is a duration in seconds with one decimal, everything else is a count.
  return metric === 'avg_watch_time' ? Math.round(grown * 10) / 10 : Math.max(0, Math.round(grown));
}

export function clampGrowth(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(GROWTH_MAX, Math.max(GROWTH_MIN, Math.round(percent)));
}
