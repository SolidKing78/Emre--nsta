import { applyMediaOverrides } from '@/features/analytics/useContentPerformance';
import { ACCOUNT_SCOPE, mediaScope, resolveWithGrowth } from '@/features/simulation/useSimulation';
import { buildMockAccountInsights, buildMockMediaInsights, mockAccount, mockMedia } from '@/mocks/mockData';
import { buildPerformance } from '@/services/analytics/content';
import { completePostMetrics } from '@/services/analytics/postInsights';
import type { AppMedia, AppMediaInsight, MetricKey } from '@/types/app';
import type { BoostMap } from '@/types/simulation';
import { buildDateRange } from '@/utils/date';

/**
 * The same post must show the same number on every screen once a dial moves:
 * feed card (media counts) · grid / ✈ count / content tab (performance from the
 * insight) · "Gönderi istatistikleri" (completePostMetrics + overlay).
 */
const NO_OVERRIDES = {};
const value = (metrics: readonly { key: MetricKey; value: number }[], key: MetricKey) => metrics.find((m) => m.key === key)?.value ?? Number.NaN;

function feedCounts(media: AppMedia, boosts: BoostMap, growth = 0) {
  const scope = mediaScope(media.id);
  return {
    likes: resolveWithGrowth(scope, 'likes', media.likeCount, NO_OVERRIDES, true, growth, boosts).displayValue,
    comments: resolveWithGrowth(scope, 'comments', media.commentCount, NO_OVERRIDES, true, growth, boosts).displayValue,
    views: media.viewCount !== undefined ? resolveWithGrowth(scope, 'views', media.viewCount, NO_OVERRIDES, true, growth, boosts).displayValue : undefined,
  };
}

function postInsightCounts(media: AppMedia, insight: AppMediaInsight | undefined, boosts: BoostMap, growth = 0) {
  const scope = mediaScope(media.id);
  const base = completePostMetrics(media, insight);
  const out: Partial<Record<MetricKey, number>> = {};
  for (const m of base) out[m.key] = resolveWithGrowth(scope, m.key, m.value, NO_OVERRIDES, true, growth, boosts).displayValue;
  return out;
}

describe('scenario consistency across screens', () => {
  const posts = mockMedia.slice(0, 6);
  const scenarios: { name: string; boosts: BoostMap; growth?: number }[] = [
    { name: 'likes +100%', boosts: { likes: 100 } },
    { name: 'plays +250% (only views set)', boosts: { plays: 250 } },
    { name: 'followers +50% + comments −25%', boosts: { followers: 50, comments: -25 } },
    { name: 'dials + growth rate', boosts: { views: 30 }, growth: 40 },
  ];

  it.each(scenarios)('$name — feed, performance and post insights agree on every post', ({ boosts, growth }) => {
    for (const media of posts) {
      const insight = buildMockMediaInsights(media.id) ?? undefined;
      const feed = feedCounts(media, boosts, growth);
      const perf = buildPerformance(media, applyMediaOverrides(insight, NO_OVERRIDES, true, growth, boosts), () => null);
      const detail = postInsightCounts(media, insight, boosts, growth);

      expect(perf.likes).toBe(feed.likes);
      expect(perf.comments).toBe(feed.comments);
      expect(detail.likes).toBe(feed.likes);
      expect(detail.comments).toBe(feed.comments);
      if (feed.views !== undefined) {
        expect(perf.views).toBe(feed.views);
        expect(detail.views).toBe(feed.views);
      }
      // What the post insights screen lists for shares / saves is what the ✈ count and the content tab use.
      expect(detail.shares).toBe(perf.shares);
      expect(detail.saves).toBe(perf.saves);
      expect(detail.reposts).toBe(perf.reposts);
      // Interactions on a post are the sum of their parts after the scenario.
      expect(perf.interactions).toBe(perf.likes + perf.comments + perf.saves + perf.shares);
    }
  });

  it('raising one dial lifts every post metric and the account figures in the same direction', () => {
    const boosts: BoostMap = { likes: 100 };
    for (const media of posts) {
      const insight = buildMockMediaInsights(media.id) ?? undefined;
      const real = buildPerformance(media, insight, () => null);
      const sim = buildPerformance(media, applyMediaOverrides(insight, NO_OVERRIDES, true, 0, boosts), () => null);
      expect(sim.likes / real.likes).toBeGreaterThan(1.9);
      expect(sim.likes / real.likes).toBeLessThan(2.1);
      expect(sim.comments).toBeGreaterThan(real.comments); // induced, ~+72%
      expect(sim.views).toBeGreaterThan(real.views); // induced, ~+80%
      expect(sim.shares).toBeGreaterThanOrEqual(real.shares);
      expect(sim.saves).toBeGreaterThanOrEqual(real.saves);
      expect(sim.reach).toBeGreaterThan(real.reach);
    }
    const account = buildMockAccountInsights(buildDateRange('30d')).metrics;
    const pick = (key: MetricKey) => resolveWithGrowth(ACCOUNT_SCOPE, key, value(account, key), NO_OVERRIDES, true, 0, boosts).displayValue;
    expect(pick('views')).toBeCloseTo(value(account, 'views') * 1.8, -2);
    expect(pick('reach')).toBeCloseTo(value(account, 'reach') * 1.68, -2);
    expect(pick('followers')).toBeCloseTo(mockAccount.followersCount * 1.24, -2);
    expect(pick('following')).toBe(value(account, 'following')); // cannot grow
    expect(pick('media_count')).toBe(value(account, 'media_count'));
  });

  it('with no dial and no growth nothing changes anywhere', () => {
    for (const media of posts) {
      const insight = buildMockMediaInsights(media.id) ?? undefined;
      expect(feedCounts(media, {})).toEqual({ likes: media.likeCount, comments: media.commentCount, views: media.viewCount });
      expect(applyMediaOverrides(insight, NO_OVERRIDES, true, 0, {})).toBe(insight);
    }
  });
});
