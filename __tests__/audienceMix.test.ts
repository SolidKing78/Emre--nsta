import { accountGenderSplit, clampPercent, followerSplitFor, genderSplitFor, normalizeMix, varyAround } from '@/services/analytics/audienceMix';
import { DEFAULT_AUDIENCE_MIX } from '@/types/simulation';

describe('audience mix defaults', () => {
  it('starts at 0.7 % followers / 99.3 % non-followers and 7 % / 93 % women-men', () => {
    expect(DEFAULT_AUDIENCE_MIX.followerShare).toBe(0.7);
    expect(accountGenderSplit(DEFAULT_AUDIENCE_MIX)).toEqual({ women: 7, men: 93 });
    const split = followerSplitFor('any-post', { ...DEFAULT_AUDIENCE_MIX, followerVariance: 0 });
    expect(split).toEqual({ followerShare: 0.7, nonFollowerShare: 99.3 });
  });
});

describe('per-post drift', () => {
  const ids = ['1', '2', '3', '4', '5', '6', '7', '8'];

  it('gives every post its own ratio around the base, and the same one every time', () => {
    const shares = ids.map((id) => genderSplitFor(id, DEFAULT_AUDIENCE_MIX).women);
    expect(new Set(shares).size).toBeGreaterThan(1);
    for (const women of shares) {
      expect(women).toBeGreaterThanOrEqual(5);
      expect(women).toBeLessThanOrEqual(9);
    }
    expect(ids.map((id) => genderSplitFor(id, DEFAULT_AUDIENCE_MIX).women)).toEqual(shares);
  });

  it('keeps both sides of a split summing to 100', () => {
    for (const id of ids) {
      const gender = genderSplitFor(id, DEFAULT_AUDIENCE_MIX);
      const followers = followerSplitFor(id, DEFAULT_AUDIENCE_MIX);
      expect(gender.women + gender.men).toBeCloseTo(100, 5);
      expect(followers.followerShare + followers.nonFollowerShare).toBeCloseTo(100, 5);
    }
  });

  it('zero variance pins every post to the base', () => {
    const mix = { ...DEFAULT_AUDIENCE_MIX, genderVariance: 0 };
    expect(ids.map((id) => genderSplitFor(id, mix).women)).toEqual(ids.map(() => 7));
  });

  it('a hand-set value skips the drift', () => {
    expect(genderSplitFor('1', DEFAULT_AUDIENCE_MIX, { womenShare: 21 })).toEqual({ women: 21, men: 79 });
    expect(followerSplitFor('1', DEFAULT_AUDIENCE_MIX, { followerShare: 12.5 })).toEqual({ followerShare: 12.5, nonFollowerShare: 87.5 });
  });

  it('never drifts out of 0…100', () => {
    const mix = { followerShare: 1, followerVariance: 50, womenShare: 99, genderVariance: 50 };
    for (const id of ids) {
      const { women } = genderSplitFor(id, mix);
      const { followerShare } = followerSplitFor(id, mix);
      expect(women).toBeGreaterThanOrEqual(0);
      expect(women).toBeLessThanOrEqual(100);
      expect(followerShare).toBeGreaterThanOrEqual(0);
      expect(followerShare).toBeLessThanOrEqual(100);
    }
  });
});

describe('normalizeMix', () => {
  it('falls back to the defaults for anything missing or unusable', () => {
    expect(normalizeMix(undefined)).toEqual(DEFAULT_AUDIENCE_MIX);
    expect(normalizeMix({ followerShare: Number.NaN })).toEqual(DEFAULT_AUDIENCE_MIX);
    expect(normalizeMix({ followerShare: 250, womenShare: -8 })).toEqual({ ...DEFAULT_AUDIENCE_MIX, followerShare: 100, womenShare: 0 });
  });

  it('caps the drift so a mix can never be swamped by its own variance', () => {
    expect(normalizeMix({ followerVariance: 80 }).followerVariance).toBe(50);
  });
});

describe('helpers', () => {
  it('clampPercent keeps one decimal inside the range', () => {
    expect(clampPercent(0.66)).toBe(0.7);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(120)).toBe(100);
  });

  it('varyAround is deterministic in its seed', () => {
    expect(varyAround(7, 2, 'seed-a')).toBe(varyAround(7, 2, 'seed-a'));
    expect(varyAround(7, 2, 'seed-a')).not.toBe(varyAround(7, 2, 'seed-b'));
  });
});
