import { buildPostBreakdown, completePostMetrics } from '@/services/analytics/postInsights';
import type { AppMedia, AppMediaInsight } from '@/types/app';

const media: AppMedia = {
  id: '3986828105981267730',
  type: 'IMAGE',
  permalink: 'https://www.instagram.com/p/DdUDwoNjo8S/',
  mediaUrl: 'https://example.com/a.jpg',
  thumbnailUrl: 'https://example.com/a.jpg',
  caption: 'Kabataş',
  timestamp: '2026-04-12T10:00:00.000Z',
  likeCount: 37,
  commentCount: 1,
  username: 'someone',
  source: 'public',
};

describe('completePostMetrics', () => {
  it('keeps source metrics untouched and fills in what the screen needs', () => {
    const insight: AppMediaInsight = {
      mediaId: media.id,
      source: 'estimated',
      metrics: [
        { key: 'views', value: 378, source: 'estimated' },
        { key: 'reach', value: 164, source: 'estimated' },
        { key: 'likes', value: 37, source: 'api' },
        { key: 'comments', value: 1, source: 'api' },
        { key: 'shares', value: 0, source: 'estimated' },
        { key: 'saves', value: 0, source: 'estimated' },
        { key: 'interactions', value: 38, source: 'estimated' },
      ],
    };
    const metrics = completePostMetrics(media, insight);
    const get = (key: string) => metrics.find((m) => m.key === key);
    expect(get('views')?.value).toBe(378);
    expect(get('reach')?.value).toBe(164);
    expect(get('likes')?.value).toBe(37);
    expect(get('profile_visits')?.source).toBe('estimated');
    expect(get('profile_visits')?.value).toBeGreaterThanOrEqual(0);
    expect(get('profile_visits')?.value).toBeLessThanOrEqual(10);
    expect(get('follows_from_post')).toBeDefined();
    expect(get('reposts')?.value).toBe(0);
    // Deterministic per post.
    expect(completePostMetrics(media, insight)).toEqual(metrics);
  });

  it('derives everything from the public counts when there is no insight yet', () => {
    const metrics = completePostMetrics(media, undefined);
    const get = (key: string) => metrics.find((m) => m.key === key)?.value ?? -1;
    expect(get('likes')).toBe(37);
    expect(get('comments')).toBe(1);
    expect(get('views')).toBeGreaterThan(37);
    expect(get('reach')).toBeLessThanOrEqual(get('views'));
    expect(get('interactions')).toBeGreaterThanOrEqual(38);
  });
});

describe('buildPostBreakdown', () => {
  it('view sources sum to 100 and the feed leads for photos, Reels for reels', () => {
    const photo = buildPostBreakdown(media, null);
    expect(photo.sources.reduce((acc, s) => acc + s.share, 0)).toBeCloseTo(100, 1);
    expect(photo.sources[0]?.key).toBe('feed');
    const reel = buildPostBreakdown({ ...media, type: 'REEL' }, null);
    expect(reel.sources[0]?.key).toBe('reels');
  });

  it('follower share follows the account audience', () => {
    const audience = { followerShare: 0.9, gender: { women: 40, men: 60 }, ages: [], cities: [], countries: [], activeHours: [], source: 'estimated' as const };
    const out = buildPostBreakdown(media, audience);
    expect(out.followerShare + out.nonFollowerShare).toBeCloseTo(100, 1);
    expect(out.followerShare).toBeGreaterThanOrEqual(80);
    expect(buildPostBreakdown(media, audience)).toEqual(out);
  });
});
