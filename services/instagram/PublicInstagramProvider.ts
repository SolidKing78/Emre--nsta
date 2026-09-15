import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { z } from 'zod';

import { CACHE_TIMES, PUBLIC_PROFILE_PROXY_URL } from '@/constants/config';
import { PublicWebProfileResponseSchema, PublicWebUserSchema, type PublicWebUser } from '@/schemas/instagram';
import { estimateAudience } from '@/services/analytics/audienceEstimator';
import { estimateAccountInsights, estimateMediaInsights } from '@/services/analytics/insightsEstimator';
import type { AppAccount, AppAudience, AppInsight, AppMedia, AppMediaInsight, AppStory, DateRange, PaginatedMedia } from '@/types/app';
import { AppError } from '@/types/errors';

import type { InstagramProvider } from './InstagramProvider';
import { normalizePublicMedia, normalizePublicProfile } from './normalize';

/**
 * Read-only provider for PUBLIC Instagram profiles.
 *
 * Uses Instagram's public web profile endpoint (the same one the logged-out web
 * client calls). No credentials, no scraping of private data. Instagram may rate
 * limit or ask for a login depending on the network; the provider tries several
 * hosts, then an optional server-side proxy, then falls back to the last cached
 * snapshot so the app keeps working offline.
 *
 * Insights are NOT available for accounts you do not own — they are estimated
 * (tagged `estimated`) and can be edited in Simulation Mode.
 */

export const USERNAME_PATTERN = /^[a-zA-Z0-9._]{1,30}$/;

export interface PublicSnapshot {
  account: AppAccount;
  media: AppMedia[];
  nextCursor?: string;
  fetchedAt: string;
  stale?: boolean;
}

const IG_APP_ID = '936619743392459';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const APP_UA =
  'Instagram 309.1.0.41.113 Android (33/13; 420dpi; 1080x2400; samsung; SM-S911B; dm1q; qcom; tr_TR; 541635890)';
const GRAPHQL_TIMELINE_HASH = '69cba40317214236af40e7efa697781d';

const cacheKey = (username: string) => `sociallens.public.v1.${username.toLowerCase()}`;

async function isOffline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 12_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'GET', headers, signal: controller.signal });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw new AppError('network', 'Request timed out');
    throw new AppError('network', err instanceof Error ? err.message : 'Network request failed', { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

function classify(status: number, text: string): AppError {
  const lower = text.slice(0, 500).toLowerCase();
  if (status === 429) return new AppError('rate_limit', 'Instagram rate limited the request', { status });
  if (status === 404) return new AppError('not_found', undefined, { status });
  if (status === 401 || status === 403 || lower.includes('login_required') || lower.includes('checkpoint_required')) {
    return new AppError('login_required', 'Instagram requires login on this network', { status });
  }
  if (lower.startsWith('<!doctype html') || lower.startsWith('<html')) {
    return new AppError('login_required', 'Instagram returned an HTML login page', { status });
  }
  if (status >= 500) return new AppError('network', 'Instagram is unavailable', { status, retryable: true });
  return new AppError('unknown', `Unexpected status ${status}`, { status });
}

type Attempt = { url: string; headers: Record<string, string> };

function buildAttempts(username: string): Attempt[] {
  const encoded = encodeURIComponent(username);
  const attempts: Attempt[] = [
    {
      url: `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encoded}`,
      headers: {
        'x-ig-app-id': IG_APP_ID,
        'User-Agent': MOBILE_UA,
        Accept: '*/*',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'x-requested-with': 'XMLHttpRequest',
        'x-asbd-id': '129477',
        Referer: `https://www.instagram.com/${encoded}/`,
      },
    },
    {
      url: `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encoded}`,
      headers: {
        'x-ig-app-id': IG_APP_ID,
        'User-Agent': APP_UA,
        Accept: '*/*',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
    },
  ];
  if (PUBLIC_PROFILE_PROXY_URL) {
    attempts.push({
      url: `${PUBLIC_PROFILE_PROXY_URL}?username=${encoded}`,
      headers: { Accept: 'application/json' },
    });
  }
  return attempts;
}

/** Runs the attempts in order and returns the first valid Instagram user payload. */
export async function fetchPublicUser(username: string): Promise<PublicWebUser> {
  let lastError: AppError = new AppError('unknown');
  for (const attempt of buildAttempts(username)) {
    try {
      const response = await fetchWithTimeout(attempt.url, attempt.headers);
      const text = await response.text();
      if (!response.ok) {
        lastError = classify(response.status, text);
        // A hard "not found" is final — no point retrying other hosts.
        if (lastError.code === 'not_found') throw lastError;
        continue;
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        lastError = classify(response.status, text);
        continue;
      }
      const parsed = PublicWebProfileResponseSchema.safeParse(json);
      if (!parsed.success) {
        // Proxy error envelope?
        const proxyError = z.object({ error: z.string(), code: z.string().optional() }).safeParse(json);
        if (proxyError.success) {
          const code = proxyError.data.code;
          lastError = new AppError(
            code === 'rate_limit' || code === 'not_found' || code === 'login_required' || code === 'private_account'
              ? code
              : 'invalid_response',
            proxyError.data.error,
          );
          if (lastError.code === 'not_found') throw lastError;
          continue;
        }
        lastError = new AppError('invalid_response', 'Unrecognized profile payload');
        continue;
      }
      const user = parsed.data.data.user;
      if (!user) throw new AppError('not_found');
      return user;
    } catch (err) {
      if (err instanceof AppError) {
        if (err.code === 'not_found') throw err;
        lastError = err;
        continue;
      }
      lastError = new AppError('unknown', err instanceof Error ? err.message : undefined, { cause: err });
    }
  }
  throw lastError;
}

async function readCache(username: string): Promise<PublicSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicSnapshot;
    if (!parsed.account || !Array.isArray(parsed.media)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(username: string, snapshot: PublicSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(username), JSON.stringify(snapshot));
  } catch {
    // Cache write failures are non-fatal.
  }
}

export async function clearPublicCache(username: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(username));
  } catch {
    // ignore
  }
}

export class PublicInstagramProvider implements InstagramProvider {
  readonly kind = 'public' as const;
  private snapshot: PublicSnapshot | null = null;
  private inflight: Promise<PublicSnapshot> | null = null;

  constructor(private readonly username: string) {}

  /** Loads (or reuses) the profile snapshot. Network → cache → stale cache. */
  async load(options: { force?: boolean } = {}): Promise<PublicSnapshot> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doLoad(options).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doLoad(options: { force?: boolean }): Promise<PublicSnapshot> {
    if (!options.force && this.snapshot && !this.snapshot.stale) {
      const age = Date.now() - new Date(this.snapshot.fetchedAt).getTime();
      if (age < CACHE_TIMES.profile) return this.snapshot;
    }
    const cached = this.snapshot ?? (await readCache(this.username));
    if (!options.force && cached) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age < CACHE_TIMES.profile) {
        this.snapshot = { ...cached, stale: false };
        return this.snapshot;
      }
    }
    if (await isOffline()) {
      if (cached) {
        this.snapshot = { ...cached, stale: true };
        return this.snapshot;
      }
      throw new AppError('offline');
    }
    try {
      const user = await fetchPublicUser(this.username);
      const normalized = normalizePublicProfile(user);
      const snapshot: PublicSnapshot = { ...normalized, fetchedAt: new Date().toISOString(), stale: false };
      this.snapshot = snapshot;
      await writeCache(this.username, snapshot);
      return snapshot;
    } catch (err) {
      if (cached && err instanceof AppError && err.code !== 'not_found') {
        this.snapshot = { ...cached, stale: true };
        return this.snapshot;
      }
      throw err;
    }
  }

  async getAccount(): Promise<AppAccount> {
    const snap = await this.load();
    return snap.account;
  }

  async getMedia(cursor?: string): Promise<PaginatedMedia> {
    const snap = await this.load();
    if (!cursor) return { items: snap.media, nextCursor: snap.nextCursor };
    return this.fetchNextPage(snap, cursor);
  }

  /** Best-effort pagination through the legacy GraphQL timeline query. Fails soft. */
  private async fetchNextPage(snap: PublicSnapshot, cursor: string): Promise<PaginatedMedia> {
    if (await isOffline()) return { items: [] };
    try {
      const variables = encodeURIComponent(JSON.stringify({ id: snap.account.id, first: 12, after: cursor }));
      const url = `https://www.instagram.com/graphql/query/?query_hash=${GRAPHQL_TIMELINE_HASH}&variables=${variables}`;
      const response = await fetchWithTimeout(url, {
        'x-ig-app-id': IG_APP_ID,
        'User-Agent': MOBILE_UA,
        Accept: '*/*',
        Referer: `https://www.instagram.com/${snap.account.username}/`,
      });
      if (!response.ok) return { items: [] };
      const json: unknown = JSON.parse(await response.text());
      const parsed = z
        .object({ data: z.object({ user: PublicWebUserSchema.pick({ edge_owner_to_timeline_media: true }).nullable() }) })
        .safeParse(json);
      const timeline = parsed.success ? parsed.data.data.user?.edge_owner_to_timeline_media : undefined;
      if (!timeline) return { items: [] };
      const items = timeline.edges.map((e) => normalizePublicMedia(e.node, snap.account.username, snap.account.profilePictureUrl));
      const known = new Set(snap.media.map((m) => m.id));
      const fresh = items.filter((m) => !known.has(m.id));
      const next = timeline.page_info?.has_next_page && timeline.page_info.end_cursor ? timeline.page_info.end_cursor : undefined;
      if (fresh.length > 0) {
        this.snapshot = { ...snap, media: [...snap.media, ...fresh], nextCursor: next };
        await writeCache(this.username, this.snapshot);
      }
      return { items: fresh, nextCursor: next };
    } catch {
      return { items: [] };
    }
  }

  async getMediaById(id: string): Promise<AppMedia> {
    const snap = await this.load();
    const media = snap.media.find((m) => m.id === id);
    if (!media) throw new AppError('not_found');
    return media;
  }

  async getAccountInsights(range: DateRange): Promise<AppInsight> {
    const snap = await this.load();
    return estimateAccountInsights(snap.account, snap.media, range);
  }

  async getMediaInsights(id: string): Promise<AppMediaInsight> {
    const snap = await this.load();
    const media = snap.media.find((m) => m.id === id);
    if (!media) throw new AppError('not_found');
    return estimateMediaInsights(media, snap.account);
  }

  async getStories(): Promise<AppStory[]> {
    const snap = await this.load();
    return [{ id: 'self', username: snap.account.username, avatarUrl: snap.account.profilePictureUrl, seen: false, isSelf: true }];
  }

  async getAudience(): Promise<AppAudience> {
    return estimateAudience(this.username);
  }

  async invalidate(): Promise<void> {
    this.snapshot = null;
    await clearPublicCache(this.username);
  }

  get lastSnapshot(): PublicSnapshot | null {
    return this.snapshot;
  }
}
