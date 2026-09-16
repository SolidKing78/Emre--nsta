import type { AppMedia, MetricKey } from '@/types/app';
import type { MediaStatOverrides } from '@/types/simulation';
import { createRng } from '@/utils/random';

import { clampPercent, round1 } from './audienceMix';

/**
 * The parts of Instagram's "Reels videosu istatistikleri" screen that no source exposes:
 * the factors behind the reach, the cumulative view curve against a typical reel, and the
 * two playback curves (how long people watched, when they interacted).
 *
 * Everything here is deterministic — seeded by the post id — so a post always shows the
 * same numbers, and every value can be replaced by a hand-set percentage
 * (`MediaStatOverrides`, dotted keys like `factor.likes` or `source.reels`).
 */

/* ------------------------------------------------------------------ */
/* Override keys                                                        */
/* ------------------------------------------------------------------ */

export function statKey(group: string, name: string): string {
  return `${group}.${name}`;
}

function overrideOf(overrides: MediaStatOverrides, group: string, name: string): number | undefined {
  const value = overrides[statKey(group, name)];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/* ------------------------------------------------------------------ */
/* "Görüntülemelerini etkileyen faktörler"                              */
/* ------------------------------------------------------------------ */

/** Instagram lists these in order of how much they drove the reach. */
export const FACTOR_KEYS = ['skip', 'shares', 'likes', 'saves', 'reposts', 'comments'] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export type FactorTrend = 'higher' | 'average' | 'lower';

export interface ViewFactor {
  key: FactorKey;
  /** Percent of viewers, one decimal. */
  percent: number;
  trend: FactorTrend;
  /** True when the trend is good news — the only case Instagram paints green. */
  positive: boolean;
  /** True while this row was set by hand. */
  isCustom: boolean;
}

/** The metric each rate is measured against; `skip` has no source metric. */
const FACTOR_METRIC: Record<FactorKey, MetricKey | null> = {
  skip: null,
  shares: 'shares',
  likes: 'likes',
  saves: 'saves',
  reposts: 'reposts',
  comments: 'comments',
};

/** Plausible band for "your typical reel", used only to place the row's trend label. */
const TYPICAL_BAND: Record<FactorKey, [number, number]> = {
  skip: [20, 35],
  shares: [0.1, 1.2],
  likes: [0.8, 3],
  saves: [0.1, 0.8],
  reposts: [0.05, 0.5],
  comments: [0.05, 0.6],
};

/** A higher skip rate is bad news; every other rate is good news when it is up. */
const GOOD_WHEN_HIGHER: Record<FactorKey, boolean> = {
  skip: false,
  shares: true,
  likes: true,
  saves: true,
  reposts: true,
  comments: true,
};

function trendOf(percent: number, typical: number): FactorTrend {
  if (typical <= 0) return percent > 0 ? 'higher' : 'average';
  const ratio = percent / typical;
  if (ratio > 1.15) return 'higher';
  if (ratio < 0.85) return 'lower';
  return 'average';
}

/**
 * The six rates under "Görüntülemelerini etkileyen faktörler".
 *
 * The rates are read off the post's own numbers (likes ÷ views and so on), so they follow
 * the scenario overlay automatically — raise the likes and the like rate rises with them.
 */
export function buildViewFactors(
  media: AppMedia,
  values: Partial<Record<MetricKey, number>>,
  overrides: MediaStatOverrides = {},
): ViewFactor[] {
  const rng = createRng(`reel-factors-${media.id}`);
  const views = Math.max(1, values.views ?? 0);
  return FACTOR_KEYS.map((key) => {
    const [low, high] = TYPICAL_BAND[key];
    const typical = low + rng() * (high - low);
    const metric = FACTOR_METRIC[key];
    const manual = overrideOf(overrides, 'factor', key);
    const derived = metric ? ((values[metric] ?? 0) / views) * 100 : typical * (0.7 + rng() * 0.8);
    const percent = clampPercent(manual ?? derived);
    return {
      key,
      percent,
      trend: trendOf(percent, typical),
      positive: GOOD_WHEN_HIGHER[key] ? trendOf(percent, typical) === 'higher' : trendOf(percent, typical) === 'lower',
      isCustom: manual !== undefined,
    };
  });
}

/* ------------------------------------------------------------------ */
/* "Zaman içindeki görüntülemeler"                                      */
/* ------------------------------------------------------------------ */

/** Windows Instagram snaps the x axis to, in minutes. */
const WINDOWS = [360, 720, 1440, 4320, 10_080, 43_200, 129_600, 525_600];

export interface CurvePoint {
  /** Minutes since the post went live. */
  t: number;
  value: number;
}

export interface ViewsOverTime {
  /** Cumulative views for this post; stops at the post's age. */
  points: CurvePoint[];
  /** Cumulative views of a typical post, across the whole window. */
  typical: CurvePoint[];
  /** Minutes the x axis spans. */
  windowMinutes: number;
  /** The three x-axis labels Instagram prints (start · middle · end). */
  labels: [string, string, string];
  /** True while the typical curve was set by hand. */
  isCustom: boolean;
}

function formatOffset(minutes: number): string {
  if (minutes <= 0) return '0';
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

/**
 * Cumulative growth: fast at first, then flattening — `1 - e^(-k·t)` normalised so the
 * curve ends exactly on the post's view count.
 */
function cumulative(total: number, fraction: number, k: number): number {
  const shaped = (1 - Math.exp(-k * fraction)) / (1 - Math.exp(-k));
  return Math.round(total * shaped);
}

export function buildViewsOverTime(media: AppMedia, views: number, overrides: MediaStatOverrides = {}, now: Date = new Date()): ViewsOverTime {
  const rng = createRng(`reel-views-time-${media.id}`);
  const published = new Date(media.timestamp);
  const ageMinutes = Math.max(30, Number.isFinite(published.getTime()) ? (now.getTime() - published.getTime()) / 60_000 : 360);
  const windowMinutes = WINDOWS.find((w) => w >= ageMinutes) ?? WINDOWS[WINDOWS.length - 1] ?? 360;

  const manual = overrideOf(overrides, 'views', 'typical');
  // How a typical post of this account compares, in percent of this post's views.
  const typicalPercent = clampPercent(manual ?? 80 + rng() * 80, 5, 400);
  const k = 2 + rng() * 1.6;

  const STEPS = 24;
  const span = Math.min(ageMinutes, windowMinutes);
  const points: CurvePoint[] = [];
  for (let i = 0; i <= STEPS; i += 1) {
    const fraction = i / STEPS;
    points.push({ t: Math.round(span * fraction), value: cumulative(views, fraction, k) });
  }
  const typical: CurvePoint[] = [];
  const typicalTotal = Math.round((views * typicalPercent) / 100);
  for (let i = 0; i <= STEPS; i += 1) {
    const fraction = i / STEPS;
    typical.push({ t: Math.round(windowMinutes * fraction), value: cumulative(typicalTotal, fraction, k * 0.75) });
  }

  return {
    points,
    typical,
    windowMinutes,
    labels: ['0', formatOffset(windowMinutes / 2), formatOffset(windowMinutes)],
    isCustom: manual !== undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Playback curves                                                      */
/* ------------------------------------------------------------------ */

export interface PlaybackCurve {
  /** Percent values, evenly spaced across the clip. */
  values: number[];
  /** Nice top of the y axis. */
  max: number;
  durationSec: number;
  isCustom: boolean;
}

const PLAYBACK_STEPS = 48;

export function durationOf(media: AppMedia, avgWatchTime?: number): number {
  if (media.durationSec && media.durationSec > 0) return Math.round(media.durationSec);
  if (avgWatchTime && avgWatchTime > 0) return Math.max(6, Math.round(avgWatchTime * 2.6));
  return 30;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * "İnsanların Reels videonu izleme süresi": the share still watching, 100 % at the start
 * decaying to `watch.end`. Uses the source's own retention curve when it has one.
 */
export function buildWatchCurve(media: AppMedia, durationSec: number, retention: number[] | undefined, overrides: MediaStatOverrides = {}): PlaybackCurve {
  const manual = overrideOf(overrides, 'watch', 'end');
  if (retention && retention.length > 1 && manual === undefined) {
    return { values: retention.map((v) => clampPercent(v * 100)), max: 100, durationSec, isCustom: false };
  }
  const rng = createRng(`reel-watch-${media.id}`);
  const end = clampPercent(manual ?? 5 + rng() * 12, 0.5, 100);
  // Exponential decay from 100 % to `end`, with a small deterministic ripple.
  const k = Math.log(100 / end);
  const values = Array.from({ length: PLAYBACK_STEPS + 1 }, (_, i) => {
    const fraction = i / PLAYBACK_STEPS;
    const base = 100 * Math.exp(-k * Math.pow(fraction, 0.75));
    return clampPercent(base * (1 + (rng() - 0.5) * 0.06), 0, 100);
  });
  values[0] = 100;
  return { values, max: 100, durationSec, isCustom: manual !== undefined };
}

/**
 * "İnsanlar Reels videonu gördüğünde": a flat line with spikes where people liked,
 * commented or shared — tallest right at the start.
 */
export function buildEngagementCurve(media: AppMedia, durationSec: number, overrides: MediaStatOverrides = {}): PlaybackCurve {
  const rng = createRng(`reel-engagement-${media.id}`);
  const manual = overrideOf(overrides, 'engagement', 'peak');
  const peak = clampPercent(manual ?? 14 + rng() * 12, 1, 100);
  const spikes = 5 + Math.floor(rng() * 4);
  const positions = Array.from({ length: spikes }, () => 0.06 + rng() * 0.9);
  const values = Array.from({ length: PLAYBACK_STEPS + 1 }, (_, i) => {
    const fraction = i / PLAYBACK_STEPS;
    let value = 0.6 + rng() * 0.8;
    for (const p of positions) {
      const distance = Math.abs(fraction - p);
      if (distance < 0.02) value = Math.max(value, peak * (0.25 + rng() * 0.35));
    }
    return round1(value);
  });
  values[0] = peak;
  values[1] = round1(peak * 0.45);
  const top = Math.max(...values);
  return { values, max: Math.max(10, Math.ceil(top / 10) * 10), durationSec, isCustom: manual !== undefined };
}

/* ------------------------------------------------------------------ */
/* Buckets with hand-set values                                         */
/* ------------------------------------------------------------------ */

export interface Bucket {
  key: string;
  label: string;
  percent: number;
  isCustom: boolean;
}

/**
 * Applies hand-set percentages to a set of bars that has to keep summing to 100:
 * the edited bars keep exactly what they were given, and what is left over is shared
 * out across the rest in proportion to what they had.
 */
export function applyBucketOverrides(items: readonly { key: string; label: string; percent: number }[], group: string, overrides: MediaStatOverrides = {}): Bucket[] {
  const manual = new Map<string, number>();
  for (const item of items) {
    const value = overrideOf(overrides, group, item.key);
    if (value !== undefined) manual.set(item.key, clampPercent(value));
  }
  if (manual.size === 0) return items.map((i) => ({ ...i, percent: round1(i.percent), isCustom: false }));

  const fixed = [...manual.values()].reduce((a, b) => a + b, 0);
  const rest = items.filter((i) => !manual.has(i.key));
  const restTotal = rest.reduce((acc, i) => acc + i.percent, 0);
  const budget = Math.max(0, 100 - fixed);

  const out = items.map((item) => {
    const value = manual.get(item.key);
    if (value !== undefined) return { ...item, percent: value, isCustom: true };
    const share = restTotal > 0 ? (item.percent / restTotal) * budget : budget / Math.max(1, rest.length);
    return { ...item, percent: round1(share), isCustom: false };
  });

  // Rounding drift lands on the largest bar that was not set by hand.
  const drift = round1(100 - out.reduce((acc, i) => acc + i.percent, 0));
  if (drift !== 0) {
    const target = out.filter((i) => !i.isCustom).sort((a, b) => b.percent - a.percent)[0];
    if (target) target.percent = clampPercent(target.percent + drift);
  }
  return out;
}
