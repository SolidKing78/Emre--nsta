import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { z } from 'zod';

import { CACHE_TIMES, PUBLIC_PROFILE_PROXY_URL } from '@/constants/config';
import { PublicWebProfileResponseSchema, PublicWebUserSchema } from '@/schemas/instagram';
import { estimateAudience } from '@/services/analytics/audienceEstimator';
import { estimateAccountInsights, estimateMediaInsights } from '@/services/analytics/insightsEstimator';
import type { AppAccount, AppAudience, AppInsight, AppMedia, AppMediaInsight, AppStory, DateRange, PaginatedMedia } from '@/types/app';
import { AppError } from '@/types/errors';

import type { InstagramProvider } from './InstagramProvider';
import { applyEmbedDetails, normalizeParsedMedia, normalizeParsedProfile, normalizePublicMedia, normalizePublicProfile } from './normalize';
import { parseEmbedPage, parseProfilePage, parseTimelineResponse, type ParsedEmbed } from './publicWebParser';

/**
 * Read-only provider for PUBLIC Instagram profiles (no login, no credentials).
 *
 * Instagram's anonymous JSON endpoints are heavily rate limited, so the primary
 * path is the plain HTML page Instagram serves to a mobile browser: it embeds
 * the profile and the first 12 posts. Per-post like / comment / view counts come
 * from Instagram's public embed pages (the same numbers an embedded post shows).
 *
 * Order of attempts for the profile: HTML page → JSON `web_profile_info` (two
 * hosts) → optional server-side proxy → last cached snapshot (stale). Nothing
 * here writes to Instagram.
 *
 * Insights are NOT available for accounts you do not own — they are estimated
 * (tagged `estimated`) and can be edited in Senaryo mode.
 */

export const USERNAME_PATTERN = /^[a-zA-Z0-9._]{1,30}$/;

export interface PublicSnapshot {
  account: AppAccount;
  media: AppMedia[];
  nextCursor?: string;
  fetchedAt: string;
  stale?: boolean;
  /** Tokens issued by the profile page; needed for the GraphQL pagination call. */
  lsd?: string;
  csrf?: string;
}

export interface PublicProfileResult {
  account: AppAccount;
  media: AppMedia[];
  nextCursor?: string;
  lsd?: string;
  csrf?: string;
}

const IG_APP_ID = '936619743392459';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const APP_UA =
  'Instagram 309.1.0.41.113 Android (33/13; 420dpi; 1080x2400; samsung; SM-S911B; dm1q; qcom; tr_TR; 541635890)';
/** `PolarisProfilePostsLoggedOutTabGridUIContentQuery` — the query the logged-out grid uses for "load more". */
const TIMELINE_DOC_ID = '28473938932242567';
const LEGACY_TIMELINE_HASH = '69cba40317214236af40e7efa697781d';

const SNAPSHOT_VERSION = 'v2';
const EMBED_TTL_MS = 6 * 60 * 60 * 1000;
const EMBED_CONCURRENCY = 4;
const EMBED_TIMEOUT_MS = 9_000;

const cacheKey = (username: string) => `sociallens.public.${SNAPSHOT_VERSION}.${username.toLowerCase()}`;
const embedCacheKey = (code: string) => `sociallens.public.post.v1.${code}`;

const HTML_HEADERS: Record<string, string> = {
  'User-Agent': MOBILE_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  // English keeps the visible counts ("14,568 likes") in a predictable format.
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

/* ------------------------------------------------------------------ */
/* Networking helpers                                                   */
/* ------------------------------------------------------------------ */

async function isOffline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit & { headers: Record<string, string> }, timeoutMs = 12_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw new AppError('network', 'Request timed out', { retryable: true });
    throw new AppError('network', err instanceof Error ? err.message : 'Network request failed', { cause: err, retryable: true });
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
    return new AppError('login_required', 'Instagram returned an HTML page instead of JSON', { status });
  }
  if (status >= 500) return new AppError('network', 'Instagram is unavailable', { status, retryable: true });
  return new AppError('unknown', `Unexpected status ${status}`, { status });
}

/* ------------------------------------------------------------------ */
/* Profile: HTML page (primary)                                         */
/* ------------------------------------------------------------------ */

type HtmlOutcome = { kind: 'ok'; result: PublicProfileResult } | { kind: 'error_page' } | { kind: 'failed'; error: AppError };

async function fetchProfileFromHtml(username: string): Promise<HtmlOutcome> {
  try {
    const response = await fetchWithTimeout(`https://www.instagram.com/${encodeURIComponent(username)}/`, { method: 'GET', headers: HTML_HEADERS }, 15_000);
    const html = await response.text();
    if (response.status === 404) return { kind: 'failed', error: new AppError('not_found', undefined, { status: 404 }) };
    if (!response.ok) return { kind: 'failed', error: classify(response.status, html) };
    const parsed = parseProfilePage(html);
    if (parsed.status === 'ok') {
      const normalized = normalizeParsedProfile(parsed);
      return { kind: 'ok', result: { ...normalized, lsd: parsed.lsd, csrf: parsed.csrf } };
    }
    if (parsed.status === 'error_page') return { kind: 'error_page' };
    return { kind: 'failed', error: new AppError('login_required', `Instagram served a ${parsed.status} page`) };
  } catch (err) {
    return { kind: 'failed', error: err instanceof AppError ? err : new AppError('unknown', err instanceof Error ? err.message : undefined, { cause: err }) };
  }
}

/* ------------------------------------------------------------------ */
/* Profile: JSON endpoints + proxy (fallbacks)                          */
/* ------------------------------------------------------------------ */

type Attempt = { url: string; headers: Record<string, string> };

function buildJsonAttempts(username: string): Attempt[] {
  const encoded = encodeURIComponent(username);
  const attempts: Attempt[] = [
    {
      url: `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encoded}`,
      headers: {
        'x-ig-app-id': IG_APP_ID,
        'User-Agent': MOBILE_UA,
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'x-requested-with': 'XMLHttpRequest',
        'x-asbd-id': '129477',
        Referer: `https://www.instagram.com/${encoded}/`,
      },
    },
    {
      url: `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encoded}`,
      headers: { 'x-ig-app-id': IG_APP_ID, 'User-Agent': APP_UA, Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9' },
    },
  ];
  if (PUBLIC_PROFILE_PROXY_URL) {
    attempts.push({ url: `${PUBLIC_PROFILE_PROXY_URL}?username=${encoded}`, headers: { Accept: 'application/json' } });
  }
  return attempts;
}

const ProxyErrorSchema = z.object({ error: z.string(), code: z.string().optional() });

/** Runs the JSON attempts in order; returns the first valid payload or throws the most relevant error. */
async function fetchProfileFromJson(username: string): Promise<PublicProfileResult> {
  let lastError: AppError = new AppError('unknown');
  for (const attempt of buildJsonAttempts(username)) {
    try {
      const response = await fetchWithTimeout(attempt.url, { method: 'GET', headers: attempt.headers });
      const text = await response.text();
      if (!response.ok) {
        lastError = classify(response.status, text);
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
        const proxyError = ProxyErrorSchema.safeParse(json);
        if (proxyError.success) {
          const code = proxyError.data.code;
          lastError = new AppError(
            code === 'rate_limit' || code === 'not_found' || code === 'login_required' || code === 'private_account' ? code : 'invalid_response',
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
      return normalizePublicProfile(user);
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

/**
 * Fetches a public profile with its most recent posts. HTML page first, then the
 * JSON endpoints and proxy. A generic Instagram error page counts as "not found"
 * only when no other source can tell us otherwise.
 */
export async function fetchPublicProfile(username: string): Promise<PublicProfileResult> {
  const html = await fetchProfileFromHtml(username);
  if (html.kind === 'ok') return html.result;
  if (html.kind === 'failed' && html.error.code === 'not_found') throw html.error;
  try {
    return await fetchProfileFromJson(username);
  } catch (err) {
    if (err instanceof AppError && err.code === 'not_found') throw err;
    if (html.kind === 'error_page') throw new AppError('not_found', 'Instagram has no page for this username');
    throw html.kind === 'failed' && err instanceof AppError && err.code === 'unknown' ? html.error : err;
  }
}

/* ------------------------------------------------------------------ */
/* Per-post details from embed pages                                    */
/* ------------------------------------------------------------------ */

async function readEmbedCache(code: string): Promise<ParsedEmbed | null> {
  try {
    const raw = await AsyncStorage.getItem(embedCacheKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; embed: ParsedEmbed };
    if (!parsed.embed || Date.now() - parsed.at > EMBED_TTL_MS) return null;
    return parsed.embed;
  } catch {
    return null;
  }
}

async function writeEmbedCache(code: string, embed: ParsedEmbed): Promise<void> {
  try {
    await AsyncStorage.setItem(embedCacheKey(code), JSON.stringify({ at: Date.now(), embed }));
  } catch {
    // non-fatal
  }
}

/** Loads the embed page for one post. `null` when Instagram did not expose the numbers. */
export async function fetchEmbedDetails(code: string, options: { force?: boolean } = {}): Promise<ParsedEmbed | null> {
  const cached = options.force ? null : await readEmbedCache(code);
  if (cached) return cached;
  const response = await fetchWithTimeout(
    `https://www.instagram.com/p/${encodeURIComponent(code)}/embed/captioned/`,
    { method: 'GET', headers: { ...HTML_HEADERS, Referer: 'https://www.instagram.com/' } },
    EMBED_TIMEOUT_MS,
  );
  if (!response.ok) {
    if (response.status === 429) throw new AppError('rate_limit', 'Instagram rate limited embed requests', { status: 429 });
    return null;
  }
  const embed = parseEmbedPage(await response.text());
  if (embed) await writeEmbedCache(code, embed);
  return embed;
}

function shortcodeOf(media: AppMedia): string | undefined {
  const match = media.permalink.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\//);
  return match?.[1];
}

/**
 * Instagram's CDN video links are signed and expire after a day or so. When playback
 * fails on a cached link, the player asks for a fresh one; this re-reads the embed
 * page (bypassing the 6 h cache) and returns the new URL, or `undefined`.
 */
export async function refreshPublicVideoUrl(media: AppMedia): Promise<string | undefined> {
  if (media.source !== 'public') return undefined;
  const code = shortcodeOf(media);
  if (!code || (await isOffline())) return undefined;
  try {
    const embed = await fetchEmbedDetails(code, { force: true });
    return embed?.videoUrl;
  } catch {
    return undefined;
  }
}

/**
 * Replaces estimated counts with the real numbers from Instagram's embed pages.
 * Runs a few requests at a time and gives up quietly once Instagram starts
 * refusing, leaving the remaining posts on their estimates.
 */
export async function enrichMediaCounts(media: AppMedia[], onProgress?: (updated: AppMedia[]) => void): Promise<AppMedia[]> {
  const out = [...media];
  const pending = out.map((item, index) => ({ item, index })).filter(({ item }) => item.countsEstimated && shortcodeOf(item));
  if (pending.length === 0) return out;
  let cursor = 0;
  let consecutiveFailures = 0;
  let stopped = false;

  const worker = async () => {
    while (!stopped && cursor < pending.length) {
      const job = pending[cursor++];
      if (!job) return;
      const code = shortcodeOf(job.item);
      if (!code) continue;
      try {
        const embed = await fetchEmbedDetails(code);
        if (embed) {
          out[job.index] = applyEmbedDetails(job.item, embed);
          consecutiveFailures = 0;
          onProgress?.(out);
        } else {
          consecutiveFailures += 1;
        }
      } catch (err) {
        consecutiveFailures += 1;
        if (err instanceof AppError && err.code === 'rate_limit') stopped = true;
      }
      if (consecutiveFailures >= 3) stopped = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(EMBED_CONCURRENCY, pending.length) }, () => worker()));
  return out;
}

/* ------------------------------------------------------------------ */
/* Snapshot cache                                                       */
/* ------------------------------------------------------------------ */

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

/** Stores a freshly fetched profile so the provider created right after sign-in does not fetch it again. */
export async function primePublicSnapshot(username: string, result: PublicProfileResult): Promise<void> {
  await writeCache(username, { ...result, fetchedAt: new Date().toISOString(), stale: false });
}

/* ------------------------------------------------------------------ */
/* Provider                                                             */
/* ------------------------------------------------------------------ */

export class PublicInstagramProvider implements InstagramProvider {
  readonly kind = 'public' as const;
  private snapshot: PublicSnapshot | null = null;
  private inflight: Promise<PublicSnapshot> | null = null;
  private enriching: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  constructor(private readonly username: string) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

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
        this.scheduleEnrichment();
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
      const result = await fetchPublicProfile(this.username);
      const snapshot: PublicSnapshot = { ...result, fetchedAt: new Date().toISOString(), stale: false };
      this.snapshot = snapshot;
      await writeCache(this.username, snapshot);
      this.scheduleEnrichment();
      return snapshot;
    } catch (err) {
      if (cached && err instanceof AppError && err.code !== 'not_found') {
        this.snapshot = { ...cached, stale: true };
        return this.snapshot;
      }
      throw err;
    }
  }

  /** Fills in real like / comment / view counts in the background and notifies subscribers. */
  private scheduleEnrichment(): void {
    if (this.enriching) return;
    const snap = this.snapshot;
    if (!snap || !snap.media.some((m) => m.countsEstimated)) return;
    this.enriching = (async () => {
      try {
        if (await isOffline()) return;
        const enriched = await enrichMediaCounts(snap.media);
        const current = this.snapshot;
        if (!current) return;
        const byId = new Map(enriched.map((m) => [m.id, m]));
        const media = current.media.map((m) => byId.get(m.id) ?? m);
        this.snapshot = { ...current, media };
        await writeCache(this.username, this.snapshot);
        this.notify();
      } catch {
        // Estimates stay in place.
      } finally {
        this.enriching = null;
      }
    })();
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

  /** Best-effort pagination: the logged-out GraphQL grid query first, then the legacy hash. Fails soft. */
  private async fetchNextPage(snap: PublicSnapshot, cursor: string): Promise<PaginatedMedia> {
    if (await isOffline()) return { items: [] };
    const known = new Set(snap.media.map((m) => m.id));
    const page = (await this.fetchTimelinePage(snap, cursor)) ?? (await this.fetchLegacyTimelinePage(snap, cursor));
    if (!page) return { items: [] };
    const fresh = page.items.filter((m) => !known.has(m.id));
    if (fresh.length > 0) {
      this.snapshot = { ...snap, media: [...snap.media, ...fresh], nextCursor: page.nextCursor };
      await writeCache(this.username, this.snapshot);
      this.scheduleEnrichment();
    }
    return { items: fresh, nextCursor: fresh.length > 0 ? page.nextCursor : undefined };
  }

  private async fetchTimelinePage(snap: PublicSnapshot, cursor: string): Promise<PaginatedMedia | null> {
    try {
      const variables = {
        enable_blocking_post_navigation: false,
        enable_grid_prefetch: false,
        first: 12,
        after: cursor,
        media_types: null,
        shid: '',
        user_id: snap.account.id,
      };
      const body = new URLSearchParams({
        av: '0',
        __d: 'www',
        __user: '0',
        __a: '1',
        lsd: snap.lsd ?? '',
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'PolarisProfilePostsLoggedOutTabGridUIContentQuery',
        variables: JSON.stringify(variables),
        server_timestamps: 'true',
        doc_id: TIMELINE_DOC_ID,
      }).toString();
      const response = await fetchWithTimeout('https://www.instagram.com/graphql/query', {
        method: 'POST',
        headers: {
          'User-Agent': MOBILE_UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: '*/*',
          'x-ig-app-id': IG_APP_ID,
          'x-fb-friendly-name': 'PolarisProfilePostsLoggedOutTabGridUIContentQuery',
          ...(snap.lsd ? { 'x-fb-lsd': snap.lsd } : {}),
          ...(snap.csrf ? { 'x-csrftoken': snap.csrf } : {}),
          Origin: 'https://www.instagram.com',
          Referer: `https://www.instagram.com/${snap.account.username}/`,
        },
        body,
      });
      if (!response.ok) return null;
      const parsed = parseTimelineResponse(JSON.parse(await response.text()));
      if (!parsed) return null;
      return { items: parsed.media.map((node) => normalizeParsedMedia(node, snap.account)), nextCursor: parsed.endCursor };
    } catch {
      return null;
    }
  }

  private async fetchLegacyTimelinePage(snap: PublicSnapshot, cursor: string): Promise<PaginatedMedia | null> {
    try {
      const variables = encodeURIComponent(JSON.stringify({ id: snap.account.id, first: 12, after: cursor }));
      const url = `https://www.instagram.com/graphql/query/?query_hash=${LEGACY_TIMELINE_HASH}&variables=${variables}`;
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'x-ig-app-id': IG_APP_ID, 'User-Agent': MOBILE_UA, Accept: '*/*', Referer: `https://www.instagram.com/${snap.account.username}/` },
      });
      if (!response.ok) return null;
      const json: unknown = JSON.parse(await response.text());
      const parsed = z
        .object({ data: z.object({ user: PublicWebUserSchema.pick({ edge_owner_to_timeline_media: true }).nullable() }) })
        .safeParse(json);
      const timeline = parsed.success ? parsed.data.data.user?.edge_owner_to_timeline_media : undefined;
      if (!timeline) return null;
      const items = timeline.edges.map((e) => normalizePublicMedia(e.node, snap.account.username, snap.account.profilePictureUrl));
      const next = timeline.page_info?.has_next_page && timeline.page_info.end_cursor ? timeline.page_info.end_cursor : undefined;
      return { items, nextCursor: next };
    } catch {
      return null;
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
