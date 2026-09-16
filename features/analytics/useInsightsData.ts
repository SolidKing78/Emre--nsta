import { useMemo } from 'react';

import { useEffectiveAudience } from '@/features/analytics/useAudienceSplits';
import { useContentPerformance } from '@/features/analytics/useContentPerformance';
import { flattenMedia, useAccount, useAccountInsights, useMediaFeed } from '@/features/instagram/hooks';
import { ACCOUNT_SCOPE, useDisplayMetrics, useEffectiveAccount, useEffectiveMedia, type DisplayMetric } from '@/features/simulation/useSimulation';
import type { ContentPerformance } from '@/services/analytics/content';
import type { AppAudience, DateRange, MediaType, MetricKey, SeriesPoint } from '@/types/app';
import { DEFAULT_AUDIENCE_MIX } from '@/types/simulation';
import { addDays, buildDateRange, isWithinRange, toISODate } from '@/utils/date';
import { createRng } from '@/utils/random';

export type InsightRangeDays = 7 | 14 | 30 | 90 | 365;

export function insightRange(days: InsightRangeDays): DateRange {
  if (days === 7) return buildDateRange('7d');
  if (days === 30) return buildDateRange('30d');
  if (days === 90) return buildDateRange('90d');
  const now = new Date();
  return { preset: 'custom', since: toISODate(addDays(now, -(days - 1))), until: toISODate(now) };
}

/** Instagram content buckets. */
export type ContentBucket = 'posts' | 'stories' | 'reels' | 'live';

export function bucketOf(type: MediaType): ContentBucket {
  if (type === 'REEL' || type === 'VIDEO') return 'reels';
  return 'posts';
}

export type InteractionKind = 'all' | 'likes' | 'comments' | 'reposts' | 'shares' | 'saves';

function interactionValue(item: ContentPerformance, kind: InteractionKind): number {
  switch (kind) {
    case 'likes':
      return item.likes;
    case 'comments':
      return item.comments;
    case 'reposts':
      return item.reposts;
    case 'shares':
      return item.shares;
    case 'saves':
      return item.saves;
    default:
      return item.interactions;
  }
}

export interface FollowerGrowth {
  total: SeriesPoint[];
  follows: SeriesPoint[];
  unfollows: SeriesPoint[];
  netTotal: number;
  followsTotal: number;
  unfollowsTotal: number;
}

/** Derives follows / unfollows / net from the new-follower series (deterministic churn). */
export function deriveFollowerGrowth(newFollowers: DisplayMetric | undefined, seed: string): FollowerGrowth {
  const series = newFollowers?.series ?? [];
  const rng = createRng(`churn-${seed}`);
  const follows: SeriesPoint[] = [];
  const unfollows: SeriesPoint[] = [];
  const total: SeriesPoint[] = [];
  for (const point of series) {
    const churn = Math.round(point.value * (0.22 + rng() * 0.2));
    follows.push({ date: point.date, value: point.value });
    unfollows.push({ date: point.date, value: churn });
    total.push({ date: point.date, value: point.value - churn });
  }
  const sum = (list: SeriesPoint[]) => list.reduce((acc, p) => acc + p.value, 0);
  return { total, follows, unfollows, netTotal: sum(total), followsTotal: sum(follows), unfollowsTotal: sum(unfollows) };
}

export function useInsightsData(range: DateRange) {
  const { data: account, isLoading: accountLoading, error: accountError } = useAccount();
  const effectiveAccount = useEffectiveAccount(account);
  const insights = useAccountInsights(range);
  const feed = useMediaFeed();
  const audience: AppAudience | null = useEffectiveAudience();
  const realMedia = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const media = useEffectiveMedia(realMedia, effectiveAccount);
  const inRange = useMemo(() => media.filter((m) => isWithinRange(m.timestamp, range)), [media, range]);
  const performance = useContentPerformance(inRange.length > 0 ? inRange : media, effectiveAccount);
  const metrics = useDisplayMetrics(ACCOUNT_SCOPE, insights.data?.metrics);
  const byKey = (key: MetricKey) => metrics.find((m) => m.key === key);
  const followerShare = audience?.followerShare ?? DEFAULT_AUDIENCE_MIX.followerShare / 100;

  const byType = useMemo(() => {
    const buckets: Record<ContentBucket, { views: number; likes: number; comments: number; shares: number; saves: number; interactions: number; count: number }> = {
      posts: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, interactions: 0, count: 0 },
      stories: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, interactions: 0, count: 0 },
      reels: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, interactions: 0, count: 0 },
      live: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, interactions: 0, count: 0 },
    };
    for (const item of performance.items) {
      const b = buckets[bucketOf(item.media.type)];
      b.views += item.views;
      b.likes += item.likes;
      b.comments += item.comments;
      b.shares += item.shares;
      b.saves += item.saves;
      b.interactions += item.interactions;
      b.count += 1;
    }
    return buckets;
  }, [performance.items]);

  const interactionsByType = (kind: InteractionKind): Record<ContentBucket, number> => {
    const out: Record<ContentBucket, number> = { posts: 0, stories: 0, reels: 0, live: 0 };
    for (const item of performance.items) out[bucketOf(item.media.type)] += interactionValue(item, kind);
    return out;
  };

  const growth = useMemo(() => deriveFollowerGrowth(byKey('new_followers'), effectiveAccount?.username ?? 'x'), [metrics, effectiveAccount?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    account,
    effectiveAccount,
    metrics,
    byKey,
    insights,
    media,
    inRange,
    performance,
    audience,
    followerShare,
    byType,
    interactionsByType,
    growth,
    isLoading: accountLoading || (insights.isLoading && !insights.data),
    error: accountError ?? (insights.isError && !insights.data ? insights.error : null),
    refetch: () => {
      void insights.refetch();
      void feed.refetch();
    },
  };
}
