import type { AppMedia, AppMediaInsight, MediaType, MetricKey } from '@/types/app';
import { metricValue } from '@/types/app';

export type ContentFilter = 'all' | 'posts' | 'reels' | 'carousels';

export type ContentSort = 'views' | 'reach' | 'engaged' | 'saves' | 'shares' | 'comments';

export interface ContentPerformance {
  media: AppMedia;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  interactions: number;
  engagementRate: number | null;
  /** Metrics that the source actually provided (others are hidden). */
  available: Set<MetricKey>;
}

export const SORT_METRIC: Record<ContentSort, MetricKey> = {
  views: 'views',
  reach: 'reach',
  engaged: 'interactions',
  saves: 'saves',
  shares: 'shares',
  comments: 'comments',
};

export function matchesFilter(type: MediaType, filter: ContentFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'posts':
      return type === 'IMAGE' || type === 'VIDEO';
    case 'reels':
      return type === 'REEL';
    case 'carousels':
      return type === 'CAROUSEL_ALBUM';
    default:
      return true;
  }
}

export function buildPerformance(
  media: AppMedia,
  insight: AppMediaInsight | undefined,
  engagementDenominator: (perf: { interactions: number; reach: number }) => number | null,
): ContentPerformance {
  const metrics = insight?.metrics ?? [];
  const available = new Set<MetricKey>(metrics.map((m) => m.key));
  const likes = available.has('likes') ? metricValue(metrics, 'likes') : media.likeCount;
  const comments = available.has('comments') ? metricValue(metrics, 'comments') : media.commentCount;
  const saves = metricValue(metrics, 'saves');
  const shares = metricValue(metrics, 'shares');
  const views = available.has('views') ? metricValue(metrics, 'views') : (media.viewCount ?? 0);
  const reach = metricValue(metrics, 'reach');
  const interactions = available.has('interactions') ? metricValue(metrics, 'interactions') : likes + comments + saves + shares;
  const denominator = engagementDenominator({ interactions, reach });
  const engagementRate = denominator && denominator > 0 ? (interactions / denominator) * 100 : null;
  if (!available.has('likes')) available.add('likes');
  if (!available.has('comments')) available.add('comments');
  if (media.viewCount !== undefined) available.add('views');
  return { media, views, reach, likes, comments, saves, shares, interactions, engagementRate, available };
}

export function sortPerformance(items: ContentPerformance[], sort: ContentSort): ContentPerformance[] {
  const key = SORT_METRIC[sort];
  const pickValue = (p: ContentPerformance): number => {
    switch (key) {
      case 'views':
        return p.views;
      case 'reach':
        return p.reach;
      case 'interactions':
        return p.interactions;
      case 'saves':
        return p.saves;
      case 'shares':
        return p.shares;
      case 'comments':
        return p.comments;
      default:
        return 0;
    }
  };
  return [...items].sort((a, b) => pickValue(b) - pickValue(a));
}

export interface TypeBreakdown {
  type: MediaType;
  count: number;
  views: number;
  reach: number;
  interactions: number;
  saves: number;
  avgReach: number;
  avgViews: number;
  avgSaves: number;
  avgInteractions: number;
}

export function breakdownByType(items: ContentPerformance[]): TypeBreakdown[] {
  const groups = new Map<MediaType, TypeBreakdown>();
  for (const item of items) {
    const type = item.media.type;
    const group = groups.get(type) ?? {
      type,
      count: 0,
      views: 0,
      reach: 0,
      interactions: 0,
      saves: 0,
      avgReach: 0,
      avgViews: 0,
      avgSaves: 0,
      avgInteractions: 0,
    };
    group.count += 1;
    group.views += item.views;
    group.reach += item.reach;
    group.interactions += item.interactions;
    group.saves += item.saves;
    groups.set(type, group);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      avgReach: g.count ? g.reach / g.count : 0,
      avgViews: g.count ? g.views / g.count : 0,
      avgSaves: g.count ? g.saves / g.count : 0,
      avgInteractions: g.count ? g.interactions / g.count : 0,
    }))
    .sort((a, b) => b.reach - a.reach);
}
