import type { AppAudience, AppMedia, AppMediaInsight, AppMetric, MetricKey } from '@/types/app';
import { addDays, eachDay, toISODate } from '@/utils/date';
import { buildSeries, createRng } from '@/utils/random';

/**
 * Instagram's "Gönderi istatistikleri" screen shows a few figures that not every
 * source exposes per post (profile visits, reposts, view sources, follower share).
 * The fill-ins here are deterministic — seeded by the post id — so a post always
 * shows the same numbers, and everything still flows through the scenario overlay.
 */

export type ViewSourceKey = 'feed' | 'reels' | 'stories' | 'profile' | 'explore' | 'other';

export interface PostViewSource {
  key: ViewSourceKey;
  /** Percent of views, one decimal; all sources sum to 100. */
  share: number;
}

export interface PostBreakdown {
  sources: PostViewSource[];
  /** Percent of viewers that follow the account. */
  followerShare: number;
  nonFollowerShare: number;
}

const ORDER: readonly MetricKey[] = ['views', 'reach', 'likes', 'comments', 'reposts', 'shares', 'saves', 'interactions', 'profile_visits', 'follows_from_post', 'avg_watch_time', 'replays'];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Reposts ("Yeniden paylaşımlar") when the source has none: a small, stable share of
 * the post's shares. One function for every screen so the number never differs.
 */
export function estimateReposts(mediaId: string, shares: number): number {
  const rng = createRng(`post-reposts-${mediaId}`);
  return Math.max(0, Math.round(shares * (0.05 + rng() * 0.2)));
}

/** Adds the per-post figures the screen needs but the source left out. Source metrics are never changed. */
export function completePostMetrics(media: AppMedia, insight: AppMediaInsight | undefined): AppMetric[] {
  const rng = createRng(`post-insights-${media.id}`);
  const byKey = new Map<MetricKey, AppMetric>((insight?.metrics ?? []).map((m) => [m.key, m]));
  const value = (key: MetricKey) => byKey.get(key)?.value;
  const put = (key: MetricKey, v: number) => {
    if (!byKey.has(key)) byKey.set(key, { key, value: Math.max(0, Math.round(v)), source: 'estimated' });
  };

  const isVideo = media.type === 'REEL' || media.type === 'VIDEO';
  const likes = value('likes') ?? media.likeCount;
  put('likes', likes);
  put('comments', value('comments') ?? media.commentCount);
  const views = value('views') ?? media.viewCount ?? likes * (isVideo ? 14 + rng() * 10 : 9 + rng() * 5);
  put('views', views);
  put('reach', value('reach') ?? views * (0.72 + rng() * 0.16));
  const shares = value('shares') ?? likes * (0.02 + rng() * 0.03);
  put('shares', shares);
  put('saves', value('saves') ?? likes * (0.05 + rng() * 0.06));
  put('reposts', value('reposts') ?? estimateReposts(media.id, shares));
  const reach = value('reach') ?? 0;
  const profileVisits = value('profile_visits') ?? reach * (0.015 + rng() * 0.035);
  put('profile_visits', profileVisits);
  put('follows_from_post', value('follows_from_post') ?? profileVisits * (rng() * 0.15));
  put('interactions', value('interactions') ?? (value('likes') ?? 0) + (value('comments') ?? 0) + (value('shares') ?? 0) + (value('saves') ?? 0));
  if (isVideo) {
    // Watch time keeps one decimal (seconds); everything else is a count.
    if (!byKey.has('avg_watch_time')) {
      const seconds = media.durationSec ? media.durationSec * (0.35 + rng() * 0.35) : 6 + rng() * 20;
      byKey.set('avg_watch_time', { key: 'avg_watch_time', value: Math.round(seconds * 10) / 10, source: 'estimated' });
    }
    put('replays', value('replays') ?? (value('views') ?? 0) * (0.05 + rng() * 0.1));
  }

  return [...byKey.values()].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
}

/**
 * Daily views since the post went live ("Zaman içindeki görüntülemeler"): the first
 * 30 days at most, front-loaded the way a post's views really arrive, summing to
 * the given total. Deterministic per post.
 */
export function buildPostViewSeries(media: AppMedia, views: number, now: Date = new Date()): { date: string; value: number }[] {
  const published = new Date(media.timestamp);
  const start = Number.isFinite(published.getTime()) ? published : now;
  const days = Math.min(30, Math.max(7, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1));
  const dates = eachDay({ preset: 'custom', since: toISODate(start), until: toISODate(addDays(start, days)) });
  return buildSeries(dates, views, `post-views-${media.id}`, { trend: -1.2, noise: 0.45, weekend: 0.9 });
}

/** View sources and follower share for a post; percentages, deterministic per post. */
export function buildPostBreakdown(media: AppMedia, audience: AppAudience | null | undefined): PostBreakdown {
  const rng = createRng(`post-breakdown-${media.id}`);
  const isReel = media.type === 'REEL';
  const weights: [ViewSourceKey, number][] = isReel
    ? [
        ['reels', 48 + rng() * 22],
        ['feed', 10 + rng() * 12],
        ['profile', 6 + rng() * 10],
        ['explore', 5 + rng() * 12],
        ['stories', 2 + rng() * 6],
        ['other', 2 + rng() * 5],
      ]
    : [
        ['feed', 45 + rng() * 18],
        ['stories', 10 + rng() * 12],
        ['profile', 9 + rng() * 12],
        ['explore', 4 + rng() * 10],
        ['other', 2 + rng() * 5],
      ];
  const total = weights.reduce((acc, [, w]) => acc + w, 0);
  const sources = weights.map(([key, w]) => ({ key, share: round1((w / total) * 100) }));
  // Keep the visible percentages summing to exactly 100.0 after rounding.
  const drift = round1(100 - sources.reduce((acc, s) => acc + s.share, 0));
  if (sources[0]) sources[0].share = round1(sources[0].share + drift);
  sources.sort((a, b) => b.share - a.share);

  const base = audience ? audience.followerShare * 100 : 82;
  const followerShare = round1(Math.min(99, Math.max(5, base + (rng() - 0.5) * 16)));
  return { sources, followerShare, nonFollowerShare: round1(100 - followerShare) };
}
