import { API_URL } from '@/constants/config';
import {
  BackendAccountSchema,
  InstagramInsightsSchema,
  InstagramMediaListSchema,
  InstagramMediaSchema,
} from '@/schemas/instagram';
import { httpJson } from '@/services/api/httpClient';
import { estimateAudience } from '@/services/analytics/audienceEstimator';
import type { AppAccount, AppAudience, AppComment, AppInsight, AppMedia, AppMediaInsight, AppMetric, AppStory, DateRange, PaginatedMedia } from '@/types/app';
import { AppError } from '@/types/errors';
import { previousRange } from '@/utils/date';

import type { InstagramProvider } from './InstagramProvider';
import { normalizeAccount, normalizeMedia, normalizeMetrics } from './normalize';

/**
 * LIVE provider. Talks ONLY to the SocialLens backend, which holds the encrypted
 * Instagram token and proxies the Meta Graph API (read-only).
 *
 * Backend contract (see supabase/functions/instagram):
 *   GET /instagram/account
 *   GET /instagram/media?after=<cursor>
 *   GET /instagram/media/:id
 *   GET /instagram/insights/account?since=YYYY-MM-DD&until=YYYY-MM-DD
 *   GET /instagram/insights/media/:id
 */
export class MetaInstagramProvider implements InstagramProvider {
  readonly kind = 'meta' as const;
  private accountCache: AppAccount | null = null;

  constructor(private readonly sessionToken: string) {
    if (!API_URL) throw new AppError('unknown', 'EXPO_PUBLIC_API_URL is not configured');
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.sessionToken}` };
  }

  private url(path: string, query?: Record<string, string | undefined>): string {
    const params = Object.entries(query ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `${API_URL}/instagram${path}${params ? `?${params}` : ''}`;
  }

  async getAccount(): Promise<AppAccount> {
    const json = await httpJson(this.url('/account'), { headers: this.headers() });
    const parsed = BackendAccountSchema.safeParse(json);
    if (!parsed.success) throw new AppError('invalid_response', 'Account payload failed validation');
    const account = normalizeAccount(parsed.data, 'live');
    if (account.accountType === 'PERSONAL') throw new AppError('not_professional');
    this.accountCache = account;
    return account;
  }

  async getMedia(cursor?: string): Promise<PaginatedMedia> {
    const json = await httpJson(this.url('/media', { after: cursor }), { headers: this.headers() });
    const parsed = InstagramMediaListSchema.safeParse(json);
    if (!parsed.success) throw new AppError('invalid_response', 'Media payload failed validation');
    const username = this.accountCache?.username ?? '';
    const avatar = this.accountCache?.profilePictureUrl;
    const items = parsed.data.data.map((raw) => ({ ...normalizeMedia(raw, username, 'live'), ownerAvatarUrl: avatar }));
    return { items, nextCursor: parsed.data.paging?.cursors?.after };
  }

  async getMediaById(id: string): Promise<AppMedia> {
    const json = await httpJson(this.url(`/media/${encodeURIComponent(id)}`), { headers: this.headers() });
    const parsed = InstagramMediaSchema.safeParse(json);
    if (!parsed.success) throw new AppError('invalid_response', 'Media payload failed validation');
    return { ...normalizeMedia(parsed.data, this.accountCache?.username ?? '', 'live'), ownerAvatarUrl: this.accountCache?.profilePictureUrl };
  }

  async getAccountInsights(range: DateRange): Promise<AppInsight> {
    const [current, previous] = await Promise.all([
      this.fetchAccountInsights(range),
      this.fetchAccountInsights(previousRange(range)).catch(() => [] as AppMetric[]),
    ]);
    const metrics: AppMetric[] = current.map((metric) => ({
      ...metric,
      previousValue: previous.find((p) => p.key === metric.key)?.value,
    }));
    const account = this.accountCache ?? (await this.getAccount());
    if (!metrics.some((m) => m.key === 'followers')) {
      metrics.push({ key: 'followers', value: account.followersCount, source: 'api' });
    }
    metrics.push({ key: 'following', value: account.followsCount, source: 'api' });
    metrics.push({ key: 'media_count', value: account.mediaCount, source: 'api' });
    return { range, metrics, source: 'api', generatedAt: new Date().toISOString() };
  }

  private async fetchAccountInsights(range: DateRange): Promise<AppMetric[]> {
    const json = await httpJson(this.url('/insights/account', { since: range.since, until: range.until }), {
      headers: this.headers(),
    });
    const parsed = InstagramInsightsSchema.safeParse(json);
    if (!parsed.success) throw new AppError('invalid_response', 'Insights payload failed validation');
    return normalizeMetrics(parsed.data.data, 'api');
  }

  async getMediaInsights(id: string): Promise<AppMediaInsight> {
    const json = await httpJson(this.url(`/insights/media/${encodeURIComponent(id)}`), { headers: this.headers() });
    const parsed = InstagramInsightsSchema.safeParse(json);
    if (!parsed.success) throw new AppError('invalid_response', 'Media insights payload failed validation');
    const metrics = normalizeMetrics(parsed.data.data, 'api');
    if (!metrics.some((m) => m.key === 'interactions')) {
      const sum = ['likes', 'comments', 'saves', 'shares'].reduce(
        (acc, key) => acc + (metrics.find((m) => m.key === key)?.value ?? 0),
        0,
      );
      if (sum > 0) metrics.push({ key: 'interactions', value: sum, source: 'api' });
    }
    return { mediaId: id, metrics, source: 'api' };
  }

  /** GET /instagram/media/:id/comments → { data: [{ id, text, username, timestamp, like_count, reply_count }] } */
  async getComments(mediaId: string): Promise<AppComment[]> {
    try {
      const json = (await httpJson(this.url(`/media/${encodeURIComponent(mediaId)}/comments`), { headers: this.headers() })) as {
        data?: { id: string; text?: string; username?: string; timestamp?: string; like_count?: number; reply_count?: number }[];
      };
      return (json?.data ?? [])
        .filter((c) => typeof c.id === 'string')
        .map((c) => ({
          id: c.id,
          username: c.username ?? '',
          avatarUrl: '',
          text: c.text ?? '',
          timestamp: c.timestamp ?? new Date().toISOString(),
          likeCount: c.like_count ?? 0,
          replyCount: c.reply_count ?? 0,
        }));
    } catch {
      // Comments need the manage_comments permission; without it the sheet simply shows the empty state.
      return [];
    }
  }

  async getStories(): Promise<AppStory[]> {
    const account = this.accountCache ?? (await this.getAccount());
    return [{ id: 'self', username: account.username, avatarUrl: account.profilePictureUrl, seen: false, isSelf: true }];
  }

  /** GET /instagram/insights/audience → { follower_share, gender, ages, cities, countries, active_hours } */
  async getAudience(): Promise<AppAudience> {
    const account = this.accountCache ?? (await this.getAccount());
    try {
      const json = (await httpJson(this.url('/insights/audience'), { headers: this.headers() })) as Partial<{
        follower_share: number;
        gender: { women: number; men: number };
        ages: { label: string; value: number }[];
        cities: { label: string; value: number }[];
        countries: { label: string; value: number }[];
        active_hours: number[];
      }>;
      if (!json || typeof json !== 'object' || !json.gender || !Array.isArray(json.ages)) throw new AppError('unsupported_metric');
      return {
        followerShare: typeof json.follower_share === 'number' ? json.follower_share : 0.4,
        gender: json.gender,
        ages: json.ages,
        cities: json.cities ?? [],
        countries: json.countries ?? [],
        activeHours: Array.isArray(json.active_hours) && json.active_hours.length === 24 ? json.active_hours : estimateAudience(account.username).activeHours,
        source: 'api',
      };
    } catch {
      // Demographics need ≥100 followers on Instagram; fall back to a deterministic estimate.
      return estimateAudience(account.username);
    }
  }

  async invalidate(): Promise<void> {
    this.accountCache = null;
  }
}
