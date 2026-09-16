import { DEFAULT_AUDIENCE_MIX, type AudienceMix, type MediaAudienceMix } from '@/types/simulation';
import { createRng } from '@/utils/random';

/**
 * Turns the account-wide audience mix into the two splits every stats screen shows:
 * followers vs non-followers, and women vs men.
 *
 * A post never shows the base value verbatim — it drifts by up to ±variance, seeded by
 * the post id, so each video has its own ratio while the account keeps the mix it was
 * given. A hand-set per-post value skips the drift entirely.
 */

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampPercent(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return round1(Math.min(max, Math.max(min, value)));
}

/** `base` ± `variance`, deterministic in `seed` and clamped to a sane percentage. */
export function varyAround(base: number, variance: number, seed: string, min = 0, max = 100): number {
  const spread = Math.max(0, variance);
  if (spread === 0) return clampPercent(base, min, max);
  const rng = createRng(seed);
  // Two draws averaged: values cluster around the base instead of spreading flat.
  const drift = ((rng() + rng()) / 2 - 0.5) * 2 * spread;
  return clampPercent(base + drift, min, max);
}

export function normalizeMix(mix: Partial<AudienceMix> | null | undefined): AudienceMix {
  const m = mix ?? {};
  const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  return {
    followerShare: clampPercent(num(m.followerShare, DEFAULT_AUDIENCE_MIX.followerShare)),
    followerVariance: clampPercent(num(m.followerVariance, DEFAULT_AUDIENCE_MIX.followerVariance), 0, 50),
    womenShare: clampPercent(num(m.womenShare, DEFAULT_AUDIENCE_MIX.womenShare)),
    genderVariance: clampPercent(num(m.genderVariance, DEFAULT_AUDIENCE_MIX.genderVariance), 0, 50),
  };
}

export interface FollowerSplit {
  followerShare: number;
  nonFollowerShare: number;
}

export interface GenderSplit {
  women: number;
  men: number;
}

/** Followers vs non-followers for one post. */
export function followerSplitFor(mediaId: string, mix: AudienceMix = DEFAULT_AUDIENCE_MIX, override?: MediaAudienceMix): FollowerSplit {
  const manual = override?.followerShare;
  const followerShare =
    typeof manual === 'number' && Number.isFinite(manual)
      ? clampPercent(manual)
      : varyAround(mix.followerShare, mix.followerVariance, `audience-followers-${mediaId}`);
  return { followerShare, nonFollowerShare: round1(100 - followerShare) };
}

/** Women vs men for one post. */
export function genderSplitFor(mediaId: string, mix: AudienceMix = DEFAULT_AUDIENCE_MIX, override?: MediaAudienceMix): GenderSplit {
  const manual = override?.womenShare;
  const women =
    typeof manual === 'number' && Number.isFinite(manual)
      ? clampPercent(manual)
      : varyAround(mix.womenShare, mix.genderVariance, `audience-gender-${mediaId}`);
  return { women, men: round1(100 - women) };
}

/** The account-wide splits (no per-post drift). */
export function accountFollowerSplit(mix: AudienceMix = DEFAULT_AUDIENCE_MIX): FollowerSplit {
  const followerShare = clampPercent(mix.followerShare);
  return { followerShare, nonFollowerShare: round1(100 - followerShare) };
}

export function accountGenderSplit(mix: AudienceMix = DEFAULT_AUDIENCE_MIX): GenderSplit {
  const women = clampPercent(mix.womenShare);
  return { women, men: round1(100 - women) };
}
