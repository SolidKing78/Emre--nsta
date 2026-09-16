import type { MetricKey } from './app';

/** Scope of a simulated metric. */
export type SimulationScope = { kind: 'account' } | { kind: 'media'; mediaId: string };

/** Key shape: "account:<metric>" or "media:<mediaId>:<metric>" */
export type OverrideKey = string;

export interface SimulationProfile {
  id: string;
  name: string;
  createdAt: string;
  overrides: Record<OverrideKey, number>;
  /** Scenario-wide growth rate in percent (0 = none). Explicit overrides win over it. */
  growthPercent?: number;
  /**
   * "Etkileşimi artır" dials: one percentage per engagement family (followers, plays,
   * views, likes, comments). A dial wins over `growthPercent` for the metrics it drives;
   * explicit overrides still win over both.
   */
  boosts?: BoostMap;
}

/** Engagement families a user can raise one by one. */
export type BoostKey = 'followers' | 'plays' | 'views' | 'likes' | 'comments';

export const BOOST_KEYS: readonly BoostKey[] = ['followers', 'plays', 'views', 'likes', 'comments'];

/** Percent per dial; a missing key means "not set" (the growth rate applies instead). */
export type BoostMap = Partial<Record<BoostKey, number>>;

export interface SimulatedMedia {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'REEL' | 'CAROUSEL_ALBUM';
  localUri: string;
  caption: string;
  timestamp: string;
  likeCount: number;
  commentCount: number;
  viewCount?: number;
}

/**
 * Who the stats say watched: the follower / non-follower split and the gender split.
 * Percentages with one decimal, account-wide.
 *
 * Instagram's reach for an account that travels on Reels is almost entirely
 * non-followers, so the defaults start at 0.7 % followers / 99.3 % non-followers and a
 * 7 % / 93 % women-men split. `*Variance` is how far a single post may drift from the
 * base — the drift is deterministic per post, so every video shows its own ratio (6/94,
 * 5/95, 8/92 …) while the account as a whole keeps the configured mix.
 */
export interface AudienceMix {
  /** Percent of viewers who follow the account. */
  followerShare: number;
  /** ± spread around `followerShare` for a single post. */
  followerVariance: number;
  /** Percent of the audience that is women. */
  womenShare: number;
  /** ± spread around `womenShare` for a single post. */
  genderVariance: number;
}

export const DEFAULT_AUDIENCE_MIX: AudienceMix = {
  followerShare: 0.7,
  followerVariance: 0.4,
  womenShare: 7,
  genderVariance: 2,
};

/** Hand-set values for one post; a missing field follows the account-wide mix. */
export interface MediaAudienceMix {
  followerShare?: number;
  womenShare?: number;
}

export type MediaAudienceMixMap = Record<string, MediaAudienceMix>;

/**
 * Hand-set percentages on the post insights screen, by dotted key — `factor.likes`,
 * `source.reels`, `age.18-24`, `country.Türkiye`, `watch.end`, `engagement.peak`,
 * `views.typical`. One flat map so a new chart never needs a new store field.
 */
export type MediaStatOverrides = Record<string, number>;

export type MediaStatMap = Record<string, MediaStatOverrides>;

export interface ProfileOverrides {
  name?: string;
  biography?: string;
  website?: string;
  category?: string;
  profilePictureUri?: string;
  isVerified?: boolean;
}

export const SIMULATABLE_ACCOUNT_METRICS: readonly MetricKey[] = [
  'followers',
  'following',
  'media_count',
  'views',
  'reach',
  'interactions',
  'profile_visits',
  'website_clicks',
  'new_followers',
  'accounts_engaged',
];

export const SIMULATABLE_MEDIA_METRICS: readonly MetricKey[] = [
  'likes',
  'comments',
  'views',
  'reach',
  'shares',
  'saves',
  'interactions',
  'follows_from_post',
  'reposts',
  'profile_visits',
];

export function overrideKey(scope: SimulationScope, metric: MetricKey): OverrideKey {
  return scope.kind === 'account' ? `account:${metric}` : `media:${scope.mediaId}:${metric}`;
}

export function parseOverrideKey(key: OverrideKey): { scope: SimulationScope; metric: MetricKey } | null {
  const parts = key.split(':');
  if (parts[0] === 'account' && parts.length === 2 && parts[1]) {
    return { scope: { kind: 'account' }, metric: parts[1] as MetricKey };
  }
  if (parts[0] === 'media' && parts.length === 3 && parts[1] && parts[2]) {
    return { scope: { kind: 'media', mediaId: parts[1] }, metric: parts[2] as MetricKey };
  }
  return null;
}

export type GrowthPreset = '+10%' | '+25%' | '+50%' | '2X' | '5X' | '10X';

export const GROWTH_PRESETS: readonly { label: GrowthPreset; factor: number }[] = [
  { label: '+10%', factor: 1.1 },
  { label: '+25%', factor: 1.25 },
  { label: '+50%', factor: 1.5 },
  { label: '2X', factor: 2 },
  { label: '5X', factor: 5 },
  { label: '10X', factor: 10 },
];
