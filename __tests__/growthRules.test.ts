import type { ContentPerformance } from '@/services/analytics/content';
import { buildRecommendations, interactionsByHour } from '@/services/recommendations/rules';
import type { AppAccount, AppMedia, MediaType, MetricKey } from '@/types/app';

const account: AppAccount = {
  id: '1',
  username: 'test',
  name: 'Test',
  biography: '',
  profilePictureUrl: '',
  accountType: 'BUSINESS',
  followersCount: 10_000,
  followsCount: 10,
  mediaCount: 20,
  isVerified: false,
  isPrivate: false,
  source: 'demo',
};

function item(type: MediaType, overrides: Partial<ContentPerformance> & { hour?: number; daysAgo?: number } = {}): ContentPerformance {
  const date = new Date(2026, 8, 15, overrides.hour ?? 12, 0, 0);
  date.setDate(date.getDate() - (overrides.daysAgo ?? 0));
  const media: AppMedia = {
    id: `${type}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    permalink: '',
    mediaUrl: '',
    thumbnailUrl: '',
    caption: 'caption',
    timestamp: date.toISOString(),
    likeCount: overrides.likes ?? 100,
    commentCount: overrides.comments ?? 5,
    username: 'test',
    source: 'demo',
  };
  const reach = overrides.reach ?? 1000;
  const saves = overrides.saves ?? 10;
  const shares = overrides.shares ?? 5;
  const likes = overrides.likes ?? 100;
  const comments = overrides.comments ?? 5;
  return {
    media,
    views: overrides.views ?? reach * 1.3,
    reach,
    likes,
    comments,
    saves,
    shares,
    reposts: 0,
    interactions: overrides.interactions ?? likes + comments + saves + shares,
    engagementRate: null,
    available: new Set<MetricKey>(['views', 'reach', 'likes', 'comments', 'saves', 'shares', 'interactions']),
  };
}

describe('buildRecommendations', () => {
  it('reports insufficient data with fewer than 3 items', () => {
    const out = buildRecommendations({ account, items: [item('IMAGE')], insights: {}, language: 'en' });
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe('insufficient_data');
    expect(out[0]?.insufficientData).toBe(true);
  });

  it('recommends Reels when reel reach beats posts by > 30%', () => {
    const items = [
      ...[0, 1, 2].map((i) => item('REEL', { reach: 5000, daysAgo: i * 2, hour: 20 })),
      ...[0, 1, 2].map((i) => item('IMAGE', { reach: 1000, daysAgo: i * 2 + 1, hour: 9 })),
    ];
    const out = buildRecommendations({ account, items, insights: {}, language: 'tr' });
    const reels = out.find((r) => r.id === 'format-reels');
    expect(reels).toBeDefined();
    expect(reels?.title).toContain('Reels');
    expect(reels?.evidence).toContain('5 B');
  });

  it('does not recommend Reels when the lift is small', () => {
    const items = [
      ...[0, 1, 2].map((i) => item('REEL', { reach: 1100, daysAgo: i })),
      ...[0, 1, 2].map((i) => item('IMAGE', { reach: 1000, daysAgo: i + 3 })),
    ];
    const out = buildRecommendations({ account, items, insights: {}, language: 'en' });
    expect(out.find((r) => r.id === 'format-reels')).toBeUndefined();
  });

  it('flags carousels that drive saves and marks hook analysis as insufficient without retention', () => {
    const items = [
      ...[0, 1, 2].map((i) => item('CAROUSEL_ALBUM', { saves: 80, daysAgo: i })),
      ...[0, 1, 2].map((i) => item('IMAGE', { saves: 10, daysAgo: i + 3 })),
      ...[0, 1, 2].map((i) => item('REEL', { saves: 10, daysAgo: i + 6 })),
    ];
    const out = buildRecommendations({ account, items, insights: {}, language: 'en' });
    expect(out.find((r) => r.id === 'format-carousel')).toBeDefined();
    const hook = out.find((r) => r.id === 'hook-insufficient');
    expect(hook?.insufficientData).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const items = [0, 1, 2, 3, 4, 5].map((i) => item('IMAGE', { daysAgo: i * 7 }));
    const a = buildRecommendations({ account, items, insights: {}, language: 'en' });
    const b = buildRecommendations({ account, items, insights: {}, language: 'en' });
    expect(a).toEqual(b);
    expect(a.find((r) => r.id === 'consistency')).toBeDefined();
  });
});

describe('interactionsByHour', () => {
  it('buckets by 2-hour windows', () => {
    const buckets = interactionsByHour([item('IMAGE', { hour: 19, interactions: 100 }), item('IMAGE', { hour: 20, interactions: 300 }), item('IMAGE', { hour: 8, interactions: 50 })]);
    expect(buckets).toHaveLength(12);
    expect(buckets.find((b) => b.hour === 18)?.count).toBe(1);
    expect(buckets.find((b) => b.hour === 20)?.avgInteractions).toBe(300);
    expect(buckets.find((b) => b.hour === 8)?.count).toBe(1);
  });
});
