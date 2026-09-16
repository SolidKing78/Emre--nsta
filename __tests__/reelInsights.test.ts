import {
  applyBucketOverrides,
  buildEngagementCurve,
  buildViewFactors,
  buildViewsOverTime,
  buildWatchCurve,
  durationOf,
  FACTOR_KEYS,
  formatClock,
  statKey,
} from '@/services/analytics/reelInsights';
import type { AppMedia } from '@/types/app';

const reel: AppMedia = {
  id: '3986828105981267730',
  type: 'REEL',
  permalink: 'https://www.instagram.com/reel/DdUDwoNjo8S/',
  mediaUrl: 'https://example.com/a.mp4',
  thumbnailUrl: 'https://example.com/a.jpg',
  caption: 'clip',
  timestamp: '2026-09-16T15:00:00.000Z',
  likeCount: 27,
  commentCount: 6,
  viewCount: 1467,
  durationSec: 89,
  username: 'someone',
  source: 'public',
};

const values = { views: 1467, reach: 1115, likes: 27, comments: 6, shares: 0, saves: 5, reposts: 2 };

describe('buildViewFactors', () => {
  it('reads every rate off the post’s own numbers', () => {
    const factors = buildViewFactors(reel, values);
    expect(factors.map((f) => f.key)).toEqual([...FACTOR_KEYS]);
    const by = (key: string) => factors.find((f) => f.key === key);
    // 27 likes / 1467 views = 1,8 %
    expect(by('likes')?.percent).toBeCloseTo(1.8, 1);
    expect(by('comments')?.percent).toBeCloseTo(0.4, 1);
    expect(by('shares')?.percent).toBe(0);
    // Skip rate has no source metric, so it is generated — but it stays plausible.
    expect(by('skip')?.percent).toBeGreaterThan(5);
    expect(by('skip')?.percent).toBeLessThan(60);
  });

  it('follows the scenario: more likes means a higher like rate', () => {
    const before = buildViewFactors(reel, values).find((f) => f.key === 'likes')?.percent ?? 0;
    const after = buildViewFactors(reel, { ...values, likes: 270 }).find((f) => f.key === 'likes')?.percent ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it('is stable per post and accepts a hand-set rate', () => {
    expect(buildViewFactors(reel, values)).toEqual(buildViewFactors(reel, values));
    const pinned = buildViewFactors(reel, values, { [statKey('factor', 'likes')]: 9.5 }).find((f) => f.key === 'likes');
    expect(pinned?.percent).toBe(9.5);
    expect(pinned?.isCustom).toBe(true);
  });

  it('paints only good news green — a higher skip rate never is', () => {
    const factors = buildViewFactors(reel, values, { [statKey('factor', 'skip')]: 90 });
    const skip = factors.find((f) => f.key === 'skip');
    expect(skip?.trend).toBe('higher');
    expect(skip?.positive).toBe(false);
  });
});

describe('buildViewsOverTime', () => {
  const now = new Date('2026-09-16T19:00:00.000Z'); // 4 hours after the post

  it('rises to the post’s view count and never goes backwards', () => {
    const out = buildViewsOverTime(reel, 1467, {}, now);
    expect(out.points[0]?.value).toBe(0);
    expect(out.points[out.points.length - 1]?.value).toBe(1467);
    for (let i = 1; i < out.points.length; i += 1) {
      expect(out.points[i]!.value).toBeGreaterThanOrEqual(out.points[i - 1]!.value);
    }
  });

  it('spans a window wide enough for the post’s age and labels it', () => {
    const out = buildViewsOverTime(reel, 1467, {}, now);
    expect(out.windowMinutes).toBe(360);
    expect(out.labels).toEqual(['0', '3h', '6h']);
    // This post's curve stops at its own age; the typical one runs to the end.
    expect(out.points[out.points.length - 1]?.t).toBe(240);
    expect(out.typical[out.typical.length - 1]?.t).toBe(360);
  });

  it('switches to days for an older post', () => {
    const old = { ...reel, timestamp: '2026-09-11T15:00:00.000Z' };
    expect(buildViewsOverTime(old, 1467, {}, now).labels).toEqual(['0', '4d', '7d']);
  });

  it('takes a hand-set comparison', () => {
    const out = buildViewsOverTime(reel, 1000, { [statKey('views', 'typical')]: 250 }, now);
    expect(out.typical[out.typical.length - 1]?.value).toBe(2500);
    expect(out.isCustom).toBe(true);
  });
});

describe('playback curves', () => {
  it('watch time starts at 100 % and decays to the set tail', () => {
    const curve = buildWatchCurve(reel, 89, undefined, { [statKey('watch', 'end')]: 8 });
    expect(curve.values[0]).toBe(100);
    expect(curve.values[curve.values.length - 1]).toBeLessThan(20);
    expect(curve.max).toBe(100);
    expect(curve.isCustom).toBe(true);
  });

  it('prefers the source’s own retention curve when nothing was set by hand', () => {
    const curve = buildWatchCurve(reel, 4, [1, 0.8, 0.5, 0.2], {});
    expect(curve.values).toEqual([100, 80, 50, 20]);
    expect(curve.isCustom).toBe(false);
  });

  it('the engagement curve peaks where it was told to', () => {
    const curve = buildEngagementCurve(reel, 89, { [statKey('engagement', 'peak')]: 22 });
    expect(curve.values[0]).toBe(22);
    expect(Math.max(...curve.values)).toBeLessThanOrEqual(curve.max);
    expect(buildEngagementCurve(reel, 89)).toEqual(buildEngagementCurve(reel, 89));
  });

  it('falls back to a sane clip length', () => {
    expect(durationOf(reel)).toBe(89);
    expect(durationOf({ ...reel, durationSec: undefined }, 12)).toBe(31);
    expect(durationOf({ ...reel, durationSec: undefined })).toBe(30);
    expect(formatClock(89)).toBe('1:29');
    expect(formatClock(5)).toBe('0:05');
  });
});

describe('applyBucketOverrides', () => {
  const buckets = [
    { key: 'reels', label: 'Reels', percent: 80 },
    { key: 'explore', label: 'Keşfet', percent: 15 },
    { key: 'feed', label: 'Akış', percent: 5 },
  ];

  it('leaves untouched buckets alone', () => {
    expect(applyBucketOverrides(buckets, 'source', {}).map((b) => b.percent)).toEqual([80, 15, 5]);
  });

  it('keeps the set bar exactly and shares the rest out proportionally', () => {
    const out = applyBucketOverrides(buckets, 'source', { 'source.reels': 60 });
    expect(out.find((b) => b.key === 'reels')?.percent).toBe(60);
    expect(out.find((b) => b.key === 'reels')?.isCustom).toBe(true);
    expect(out.reduce((acc, b) => acc + b.percent, 0)).toBeCloseTo(100, 1);
    // 15 : 5 stays 3 : 1 inside the 40 % that is left.
    expect(out.find((b) => b.key === 'explore')?.percent).toBeCloseTo(30, 1);
    expect(out.find((b) => b.key === 'feed')?.percent).toBeCloseTo(10, 1);
  });

  it('never goes over 100 when the set bars already fill it', () => {
    const out = applyBucketOverrides(buckets, 'source', { 'source.reels': 100 });
    expect(out.reduce((acc, b) => acc + b.percent, 0)).toBeCloseTo(100, 1);
    expect(out.find((b) => b.key === 'feed')?.percent).toBe(0);
  });
});

describe('edge cases', () => {
  const now = new Date('2026-09-16T19:00:00.000Z');

  it('a post with no views yet does not blow the rates up', () => {
    const factors = buildViewFactors(reel, { views: 0, likes: 0, comments: 0 });
    for (const f of factors) {
      expect(Number.isFinite(f.percent)).toBe(true);
      expect(f.percent).toBeGreaterThanOrEqual(0);
      expect(f.percent).toBeLessThanOrEqual(100);
    }
  });

  it('a post with no metrics at all still produces a full set of rows', () => {
    const factors = buildViewFactors(reel, {});
    expect(factors).toHaveLength(FACTOR_KEYS.length);
    expect(factors.every((f) => Number.isFinite(f.percent))).toBe(true);
  });

  it('a rate above 100 is clamped rather than drawn off the bar', () => {
    const factors = buildViewFactors(reel, { views: 10, likes: 5000 });
    expect(factors.find((f) => f.key === 'likes')?.percent).toBe(100);
  });

  it('a zero-view curve stays flat instead of dividing by zero', () => {
    const out = buildViewsOverTime(reel, 0, {}, now);
    expect(out.points.every((p) => p.value === 0)).toBe(true);
    expect(out.typical.every((p) => Number.isFinite(p.value))).toBe(true);
  });

  it('a post published in the future is treated as brand new', () => {
    const future = { ...reel, timestamp: '2027-01-01T00:00:00.000Z' };
    const out = buildViewsOverTime(future, 100, {}, now);
    expect(out.windowMinutes).toBe(360);
    expect(out.points[out.points.length - 1]?.value).toBe(100);
  });

  it('a post with an unreadable timestamp still gets a window', () => {
    const broken = { ...reel, timestamp: 'not a date' };
    const out = buildViewsOverTime(broken, 100, {}, now);
    expect(out.windowMinutes).toBeGreaterThan(0);
    expect(out.labels).toHaveLength(3);
  });

  it('a year-old post lands on the widest window', () => {
    const old = { ...reel, timestamp: '2024-01-01T00:00:00.000Z' };
    expect(buildViewsOverTime(old, 100, {}, now).windowMinutes).toBe(525_600);
  });

  it('the watch curve survives a tail of 0 and a tail of 100', () => {
    for (const end of [0, 100]) {
      const curve = buildWatchCurve(reel, 89, undefined, { [statKey('watch', 'end')]: end });
      expect(curve.values.every((v) => Number.isFinite(v) && v >= 0 && v <= 100)).toBe(true);
      expect(curve.values[0]).toBe(100);
    }
  });

  it('a one-bucket set of bars still adds up', () => {
    const out = applyBucketOverrides([{ key: 'only', label: 'Only', percent: 100 }], 'source', { 'source.only': 40 });
    expect(out[0]?.percent).toBe(40);
  });

  it('bars that were all pinned keep exactly what they were given', () => {
    const out = applyBucketOverrides(
      [
        { key: 'a', label: 'A', percent: 50 },
        { key: 'b', label: 'B', percent: 50 },
      ],
      'source',
      { 'source.a': 70, 'source.b': 30 },
    );
    expect(out.map((b) => b.percent)).toEqual([70, 30]);
    expect(out.every((b) => b.isCustom)).toBe(true);
  });

  it('a bucket list that does not start at 100 is still normalised once something is pinned', () => {
    const out = applyBucketOverrides(
      [
        { key: 'a', label: 'A', percent: 10 },
        { key: 'b', label: 'B', percent: 10 },
      ],
      'age',
      { 'age.a': 20 },
    );
    expect(out.reduce((acc, b) => acc + b.percent, 0)).toBeCloseTo(100, 1);
  });

  it('an empty bucket list is handled', () => {
    expect(applyBucketOverrides([], 'source', { 'source.x': 10 })).toEqual([]);
  });
});
