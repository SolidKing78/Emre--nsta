/**
 * Normalized application types. UI code ONLY consumes these — never raw API shapes.
 */

export type DataSource = 'demo' | 'live' | 'public' | 'manual';

export type MediaType = 'IMAGE' | 'VIDEO' | 'REEL' | 'CAROUSEL_ALBUM' | 'UNKNOWN';

export type AccountType = 'BUSINESS' | 'CREATOR' | 'PERSONAL' | 'UNKNOWN';

export type ApiStatus = 'connected' | 'token_expiring' | 'auth_required' | 'sync_error' | 'public' | 'demo' | 'manual';

export type MetricSource = 'api' | 'mock' | 'estimated' | 'manual';

export type MetricKey =
  | 'views'
  | 'reach'
  | 'interactions'
  | 'followers'
  | 'following'
  | 'media_count'
  | 'profile_visits'
  | 'website_clicks'
  | 'new_followers'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'accounts_engaged'
  | 'avg_watch_time'
  | 'replays'
  | 'follows_from_post'
  | 'reposts';

export interface SeriesPoint {
  /** ISO date (yyyy-mm-dd) */
  date: string;
  value: number;
}

export interface AppMetric {
  key: MetricKey;
  value: number;
  previousValue?: number;
  series?: SeriesPoint[];
  source: MetricSource;
}

export interface AppAccount {
  id: string;
  username: string;
  name: string;
  biography: string;
  website?: string;
  profilePictureUrl: string;
  accountType: AccountType;
  category?: string;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
  isVerified: boolean;
  isPrivate: boolean;
  source: DataSource;
  connectedAt?: string;
  lastSyncAt?: string;
  tokenExpiresAt?: string;
}

export interface AppMediaChild {
  id: string;
  type: MediaType;
  mediaUrl: string;
  thumbnailUrl: string;
  /** Direct video file for video slides of an album, when the source exposes one. */
  videoUrl?: string;
}

export interface AppMedia {
  id: string;
  type: MediaType;
  permalink: string;
  mediaUrl: string;
  thumbnailUrl: string;
  caption: string;
  /** ISO timestamp */
  timestamp: string;
  likeCount: number;
  commentCount: number;
  /** Public video view count when exposed by the source */
  viewCount?: number;
  children?: AppMediaChild[];
  username: string;
  ownerAvatarUrl?: string;
  location?: string;
  aspectRatio?: number;
  isPinned?: boolean;
  /** True for posts that exist only in the simulation overlay (never on Instagram). */
  isSimulated?: boolean;
  /** Like / comment counts are estimates because the source did not expose them (yet). */
  countsEstimated?: boolean;
  /** Direct video file when the source exposes one (public reels / videos). */
  videoUrl?: string;
  /** Video length in seconds when known. */
  durationSec?: number;
  /** "Artist · Song" line for reels when the source exposes the audio attribution. */
  music?: string;
  /** Public reshare count when known; otherwise derived from insights. */
  shareCount?: number;
  source: DataSource;
}

export interface PaginatedMedia {
  items: AppMedia[];
  nextCursor?: string;
}

export type DateRangePreset = '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  /** ISO yyyy-mm-dd inclusive */
  since: string;
  /** ISO yyyy-mm-dd inclusive */
  until: string;
}

export interface AppInsight {
  range: DateRange;
  metrics: AppMetric[];
  /** Whether metrics came from an API (live), mocks (demo) or estimates (public) */
  source: MetricSource;
  generatedAt: string;
}

export interface AppMediaInsight {
  mediaId: string;
  metrics: AppMetric[];
  source: MetricSource;
  /** Retention curve (0..1 per second) — only when the source supports it */
  retention?: number[];
}

export interface AppStory {
  id: string;
  username: string;
  avatarUrl: string;
  seen: boolean;
  isSelf?: boolean;
}

export interface AppHighlight {
  id: string;
  title: string;
  coverUrl: string;
}

export interface AppComment {
  id: string;
  username: string;
  avatarUrl: string;
  text: string;
  timestamp: string;
  likeCount: number;
  /** Number of replies under the comment (shown as "N diğer yanıtı gör"). */
  replyCount?: number;
  isVerified?: boolean;
}

export interface AppActivityItem {
  id: string;
  kind: 'follow' | 'like' | 'comment' | 'milestone' | 'sync' | 'recommendation' | 'simulation';
  title: string;
  subtitle?: string;
  timestamp: string;
  avatarUrl?: string;
  mediaThumbnailUrl?: string;
  route?: string;
}

export const METRIC_KEYS: readonly MetricKey[] = [
  'views',
  'reach',
  'interactions',
  'followers',
  'following',
  'media_count',
  'profile_visits',
  'website_clicks',
  'new_followers',
  'likes',
  'comments',
  'shares',
  'saves',
  'accounts_engaged',
  'avg_watch_time',
  'replays',
  'follows_from_post',
];

export function findMetric(metrics: readonly AppMetric[] | undefined, key: MetricKey): AppMetric | undefined {
  return metrics?.find((m) => m.key === key);
}

export function metricValue(metrics: readonly AppMetric[] | undefined, key: MetricKey, fallback = 0): number {
  return findMetric(metrics, key)?.value ?? fallback;
}

/* ------------------------------------------------------------------ */
/* Audience (Instagram "Hedef kitle")                                    */
/* ------------------------------------------------------------------ */

export interface AudienceBucket {
  label: string;
  /** Percent 0..100 */
  value: number;
}

export interface AppAudience {
  /** Share (0..1) of views that came from followers. */
  followerShare: number;
  gender: { women: number; men: number };
  ages: AudienceBucket[];
  cities: AudienceBucket[];
  countries: AudienceBucket[];
  /** Most active hours (0..23) → relative activity 0..1 */
  activeHours: number[];
  source: MetricSource;
}
