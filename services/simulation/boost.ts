import type { MetricKey } from '@/types/app';
import { BOOST_KEYS, type BoostKey, type BoostMap, type SimulationScope } from '@/types/simulation';

import { clampGrowth, deviation, GROWTH_ELASTICITY } from './growth';

/**
 * "Etkileşimi artır" — five dials (followers · plays · views · likes · comments),
 * each a percentage. The dials are COUPLED the way real Instagram numbers are:
 *
 *   1. The metrics a dial names move by exactly that percentage (`ACCOUNT_TARGETS`,
 *      `MEDIA_TARGETS`; e.g. likes +100% → every post's likes +100%).
 *   2. Every dial that is set implies a change in overall attention on the account
 *      (`DIAL_UPSTREAM`: likes +100% means roughly +80% more people saw the posts).
 *      The scenario growth rate counts as one more such signal. They are merged
 *      with `combine()` — the strongest signal leads, the rest add a quarter.
 *   3. Every other metric follows that latent attention through the same
 *      elasticities the growth rate uses (`GROWTH_ELASTICITY`): comments +90% of it,
 *      saves +115%, reach +85%, profile visits +60%, followers +30%, and so on.
 *      Counts that cannot grow (following, post count) stay put.
 *   4. Totals made of parts (interactions, accounts engaged) follow the effective
 *      likes / comments / shares / saves change weighted by their usual share of the
 *      total (likes dominate), so the account card moves like the per-post sums do.
 *
 * So raising ONE dial lifts likes, comments, views, shares, saves, reach, profile
 * visits and followers together, in proportion. An explicit per-metric override
 * still wins over everything (see `resolveMetric`).
 */

interface BoostTarget {
  key: BoostKey;
  /** 1 = moves by the full percentage; 0.85 = 85% of it. */
  weight: number;
}

const ACCOUNT_TARGETS: Partial<Record<MetricKey, BoostTarget>> = {
  followers: { key: 'followers', weight: 1 },
  new_followers: { key: 'followers', weight: 1 },
  views: { key: 'views', weight: 1 },
  reach: { key: 'views', weight: 0.85 },
};

const MEDIA_TARGETS: Partial<Record<MetricKey, BoostTarget>> = {
  views: { key: 'plays', weight: 1 },
  replays: { key: 'plays', weight: 1 },
  reach: { key: 'plays', weight: 0.85 },
  profile_visits: { key: 'plays', weight: 0.6 },
  likes: { key: 'likes', weight: 1 },
  comments: { key: 'comments', weight: 1 },
  follows_from_post: { key: 'followers', weight: 1 },
};

/** How much a change in a dial implies about overall attention (views) on the account. */
export const DIAL_UPSTREAM: Record<BoostKey, number> = {
  views: 1,
  plays: 1,
  likes: 0.8,
  comments: 0.7,
  followers: 0.6,
};

/** The metric whose elasticity stands in for a dial when the dial itself is not set. */
export const DIAL_PRIMARY: Record<BoostKey, MetricKey> = {
  followers: 'followers',
  plays: 'views',
  views: 'views',
  likes: 'likes',
  comments: 'comments',
};

/** Metrics that are sums of the engagement parts. */
const DERIVED_WEIGHT: Partial<Record<MetricKey, number>> = {
  interactions: 1,
  accounts_engaged: 0.9,
};

/** Typical share of each part in an account's interactions — likes dominate the total. */
const ENGAGEMENT_PARTS: readonly { metric: MetricKey; weight: number }[] = [
  { metric: 'likes', weight: 0.78 },
  { metric: 'comments', weight: 0.07 },
  { metric: 'shares', weight: 0.06 },
  { metric: 'saves', weight: 0.09 },
];
const PART_DIAL: Partial<Record<MetricKey, BoostKey>> = { likes: 'likes', comments: 'comments' };

function isSet(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value !== 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Strongest signal leads, the others add a quarter each — two +100% dials do not make +200%. */
export function combine(values: readonly number[]): number {
  const set = values.filter((v) => Number.isFinite(v) && v !== 0);
  if (set.length === 0) return 0;
  const lead = set.reduce((best, v) => (Math.abs(v) > Math.abs(best) ? v : best), set[0] as number);
  const rest = set.reduce((acc, v) => acc + v, 0) - lead;
  return lead + rest * 0.25;
}

/**
 * Latent attention growth (percent) implied by the dials and the growth rate.
 * `undefined` when no dial is set — the plain growth rate path applies then.
 */
export function latentGrowth(boosts: BoostMap | undefined, growthPercent = 0): number | undefined {
  if (!boosts) return undefined;
  const signals = BOOST_KEYS.filter((key) => isSet(boosts[key])).map((key) => (boosts[key] as number) * DIAL_UPSTREAM[key]);
  if (signals.length === 0) return undefined;
  if (growthPercent !== 0) signals.push(growthPercent);
  return combine(signals);
}

function directPercent(boosts: BoostMap, scope: SimulationScope, metric: MetricKey): number | undefined {
  const target = (scope.kind === 'account' ? ACCOUNT_TARGETS : MEDIA_TARGETS)[metric];
  if (!target) return undefined;
  const percent = boosts[target.key];
  return isSet(percent) ? percent * target.weight : undefined;
}

function inducedPercent(latent: number, metric: MetricKey): number | undefined {
  const elasticity = GROWTH_ELASTICITY[metric] ?? 1;
  if (elasticity === 0) return undefined;
  return latent * elasticity;
}

/**
 * Effective boost percentage for a metric in a scope: the dial that names it, else
 * the change induced by the other dials, else `undefined` (nothing set).
 */
export function boostPercentFor(boosts: BoostMap | undefined, scope: SimulationScope, metric: MetricKey, growthPercent = 0): number | undefined {
  if (!boosts) return undefined;
  const direct = directPercent(boosts, scope, metric);
  if (direct !== undefined) return direct;
  const latent = latentGrowth(boosts, growthPercent);
  if (latent === undefined) return undefined;
  const derived = DERIVED_WEIGHT[metric];
  if (derived !== undefined) {
    // Interactions are the sum of their parts: follow the parts' effective change,
    // weighted by their share of the total (a likes / comments dial counts in full at both scopes).
    const total = ENGAGEMENT_PARTS.reduce((acc, part) => {
      const dial = PART_DIAL[part.metric];
      const own = dial ? boosts[dial] : undefined;
      const percent = isSet(own) ? own : (inducedPercent(latent, part.metric) ?? 0);
      return acc + percent * part.weight;
    }, 0);
    return total * derived;
  }
  return inducedPercent(latent, metric);
}

export type DialSource = 'set' | 'induced' | 'growth' | 'none';

/** What each dial effectively does right now — its own value, or what the others / the growth rate pull it to. */
export function effectiveDial(boosts: BoostMap | undefined, key: BoostKey, growthPercent = 0): { percent: number; source: DialSource } {
  const own = boosts?.[key];
  if (isSet(own)) return { percent: own, source: 'set' };
  const elasticity = GROWTH_ELASTICITY[DIAL_PRIMARY[key]] ?? 1;
  const latent = latentGrowth(boosts, growthPercent);
  if (latent !== undefined) return { percent: round1(latent * elasticity), source: 'induced' };
  if (growthPercent !== 0) return { percent: round1(growthPercent * elasticity), source: 'growth' };
  return { percent: 0, source: 'none' };
}

/** Applies a boost percentage to a real value, with the same per-post deviation the growth rate uses. */
export function applyBoost(realValue: number, percent: number, seed?: string, metric?: MetricKey): number {
  if (!Number.isFinite(percent) || percent === 0) return realValue;
  const jitter = seed ? deviation(seed, percent) : 0;
  const factor = Math.max(0, (1 + percent / 100) * (1 + jitter));
  const grown = realValue * factor;
  // Watch time is a duration in seconds with one decimal, everything else is a count.
  return metric === 'avg_watch_time' ? Math.max(0, round1(grown)) : Math.max(0, Math.round(grown));
}

/** Drops zero / invalid dials and clamps the rest to the growth range. */
export function normalizeBoosts(boosts: BoostMap | undefined): BoostMap {
  const out: BoostMap = {};
  if (!boosts) return out;
  for (const key of BOOST_KEYS) {
    const value = boosts[key];
    if (!isSet(value)) continue;
    const clamped = clampGrowth(value);
    if (clamped !== 0) out[key] = clamped;
  }
  return out;
}

export function countBoosts(boosts: BoostMap | undefined): number {
  if (!boosts) return 0;
  return BOOST_KEYS.filter((key) => isSet(boosts[key])).length;
}

export function boostsEqual(a: BoostMap | undefined, b: BoostMap | undefined): boolean {
  return BOOST_KEYS.every((key) => (a?.[key] ?? 0) === (b?.[key] ?? 0));
}
