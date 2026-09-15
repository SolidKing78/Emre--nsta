/**
 * Parsers for Instagram's logged-out web pages.
 *
 * Instagram's JSON endpoints (`web_profile_info`, GraphQL) are aggressively rate
 * limited for anonymous clients, but the plain HTML pages served to a mobile
 * browser still embed the data the page needs to render:
 *
 *   - `https://www.instagram.com/<username>/`   → profile + the first 12 posts
 *   - `https://www.instagram.com/p/<code>/embed/captioned/` → per-post like /
 *     comment / view counts (the same numbers shown under an embedded post)
 *
 * Everything here is a pure function over the HTML string so the same code runs
 * in the app and in the Supabase proxy (`supabase/functions/_shared/publicWebParser.ts`
 * is a copy — keep them in sync). No platform imports.
 */

export interface ParsedPublicUser {
  /** Numeric Instagram user id (`pk`). Stable across page variants. */
  pk: string;
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl: string;
  isVerified: boolean;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  /** Post count. Instagram only exposes a rounded figure ("32K") for large accounts. */
  mediaCount?: number;
  externalUrl?: string;
  category?: string;
}

export type ParsedMediaKind = 'image' | 'video' | 'carousel';

export interface ParsedTimelineNode {
  pk: string;
  /** URL shortcode, derived from the id when the page does not include it. */
  code: string;
  kind: ParsedMediaKind;
  /** "clips" for Reels, "feed" for photos/videos, "carousel_container" for albums. */
  productType: string;
  imageUrl: string;
  width?: number;
  height?: number;
  caption: string;
  isPinned: boolean;
  /** Present only when the page exposes it (rare for logged-out pages). */
  takenAt?: number;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
}

export type ParsedProfilePage =
  | {
      status: 'ok';
      user: ParsedPublicUser;
      media: ParsedTimelineNode[];
      endCursor?: string;
      /** Tokens the page issues; needed for the follow-up GraphQL pagination call. */
      lsd?: string;
      csrf?: string;
    }
  /** `error_page`: Instagram rendered its generic error page — a missing account, or a blocked request. */
  | { status: 'error_page' | 'login_wall' | 'unrecognized' };

export interface ParsedEmbedChild {
  id: string;
  isVideo: boolean;
  displayUrl?: string;
  videoUrl?: string;
}

export interface ParsedEmbed {
  shortcode?: string;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  videoDuration?: number;
  videoUrl?: string;
  displayUrl?: string;
  width?: number;
  height?: number;
  caption?: string;
  isVideo?: boolean;
  takenAt?: number;
  /** "Artist · Song" when the reel carries audio attribution. */
  music?: string;
  children?: ParsedEmbedChild[];
  /** True when counts came from the structured payload rather than the visible text. */
  structured: boolean;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                        */
/* ------------------------------------------------------------------ */

const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Instagram media ids are Snowflake-style: (ms since 2011-08-24) << 23 | shard | sequence. */
const ID_EPOCH_MS = 1314220021721n;

/** Converts a numeric media id (`pk`) into the shortcode used in `/p/<code>/` URLs. */
export function shortcodeFromMediaId(pk: string): string {
  let n: bigint;
  try {
    n = BigInt(pk);
  } catch {
    return '';
  }
  if (n <= 0n) return '';
  let out = '';
  while (n > 0n) {
    out = SHORTCODE_ALPHABET[Number(n % 64n)] + out;
    n /= 64n;
  }
  return out;
}

/** Approximate creation time (ms) encoded in a media id. Accurate to a few hours. */
export function timestampFromMediaId(pk: string): number | undefined {
  try {
    const n = BigInt(pk);
    if (n <= 0n) return undefined;
    const ms = (n >> 23n) + ID_EPOCH_MS;
    const value = Number(ms);
    return Number.isFinite(value) && value > 1_300_000_000_000 && value < 4_000_000_000_000 ? value : undefined;
  } catch {
    return undefined;
  }
}

/** "269M" → 269000000, "4,130" → 4130, "1.5K" → 1500, "12" → 12. */
export function parseCompactNumber(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const text = raw.replace(/\s+/g, '').toUpperCase();
  const match = text.match(/^([\d.,]+)([KMB]|MN|BN)?$/);
  if (!match) return undefined;
  let digits = match[1] ?? '';
  const suffix = match[2];
  // "4,130" and "1,234,567" use commas as thousands separators; "1.5K" uses a decimal point.
  if (/^\d{1,3}(,\d{3})+$/.test(digits)) digits = digits.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(digits)) digits = digits.replace(',', '.');
  const value = Number(digits);
  if (!Number.isFinite(value)) return undefined;
  const factor = suffix === 'K' ? 1e3 : suffix === 'M' || suffix === 'MN' ? 1e6 : suffix === 'B' || suffix === 'BN' ? 1e9 : 1;
  return Math.round(value * factor);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;|&apos;/g, "'");
}

function metaContent(html: string, property: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`, 'i');
  const match = html.match(re);
  return match?.[1] !== undefined ? decodeEntities(match[1]) : undefined;
}

/** Follower / following / post counts as written in the profile page's og:description. */
export function parseOgCounts(html: string): { followers?: number; following?: number; posts?: number } {
  const description = metaContent(html, 'og:description');
  if (!description) return {};
  const numbers = [...description.matchAll(/([\d][\d.,]*\s?(?:[KMB]|Mn|Bn)?)\s+[^\d,]+?(?:,|$| -)/g)].map((m) => parseCompactNumber(m[1]));
  const [followers, following, posts] = numbers;
  return { followers, following, posts };
}

/** Extracts every `<script type="application/json" ... data-sjs>` payload the page ships. */
function jsonBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const body = match[1];
    if (!body || body.length < 2) continue;
    try {
      blocks.push(JSON.parse(body));
    } catch {
      // Not every block is JSON we care about.
    }
  }
  return blocks;
}

/** Depth-first search for the first object that owns `key`. */
function findObjectWithKey(root: unknown, key: string, depth = 0): Record<string, unknown> | null {
  if (!root || typeof root !== 'object' || depth > 40) return null;
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findObjectWithKey(item, key, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = root as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj;
  for (const value of Object.values(obj)) {
    const found = findObjectWithKey(value, key, depth + 1);
    if (found) return found;
  }
  return null;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);

/* ------------------------------------------------------------------ */
/* Profile page                                                         */
/* ------------------------------------------------------------------ */

function bestImageCandidate(node: Record<string, unknown>): { url: string; width?: number; height?: number } {
  const versions = node.image_versions2 as { candidates?: { url?: string; width?: number; height?: number }[] } | undefined;
  const candidates = versions?.candidates ?? [];
  // Candidates are sorted large → small; pick the largest one that is at most 1080 wide to keep the grid cheap.
  const preferred = candidates.find((c) => typeof c.url === 'string' && (c.width ?? 0) <= 1080) ?? candidates[0];
  if (preferred?.url) return { url: preferred.url, width: preferred.width, height: preferred.height };
  return { url: str(node.display_uri) };
}

function kindOf(node: Record<string, unknown>): ParsedMediaKind {
  const typename = str(node.__typename);
  const mediaType = num(node.media_type);
  if (typename === 'XIGPolarisCarouselMedia' || mediaType === 8) return 'carousel';
  if (typename === 'XIGPolarisVideoMedia' || mediaType === 2) return 'video';
  return 'image';
}

function parseTimelineNode(raw: unknown): ParsedTimelineNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const node = raw as Record<string, unknown>;
  const pk = str(node.pk) || str(node.id).replace(/^POLARIS_/, '');
  if (!/^\d+$/.test(pk)) return null;
  const image = bestImageCandidate(node);
  const caption = node.caption as { text?: string } | null | undefined;
  return {
    pk,
    code: str(node.code) || shortcodeFromMediaId(pk),
    kind: kindOf(node),
    productType: str(node.product_type, 'feed'),
    imageUrl: image.url,
    width: image.width,
    height: image.height,
    caption: str(caption?.text),
    isPinned: bool(node.is_timeline_pinned),
    takenAt: num(node.taken_at),
    likeCount: num(node.like_count),
    commentCount: num(node.comment_count),
    viewCount: num(node.play_count) ?? num(node.view_count) ?? num(node.ig_play_count),
  };
}

function isErrorPage(html: string): boolean {
  return /"pageID":"httpErrorPage"|PolarisErrorRoot|Sorry, this page isn['’]t available|isn&#x27;t available/i.test(html);
}

function isLoginWall(html: string): boolean {
  return /"LoginForm"|id="loginForm"|\/accounts\/login\/\?next=|PolarisLoginRoot/i.test(html);
}

/** Parses `https://www.instagram.com/<username>/` as served to a mobile browser. */
export function parseProfilePage(html: string): ParsedProfilePage {
  if (!html || html.length < 200) return { status: 'unrecognized' };
  const blocks = jsonBlocks(html);

  let userObj: Record<string, unknown> | null = null;
  let timeline: Record<string, unknown> | null = null;
  for (const block of blocks) {
    if (!userObj) {
      const candidate = findObjectWithKey(block, 'follower_count');
      if (candidate && typeof candidate.username === 'string') userObj = candidate;
    }
    if (!timeline) timeline = findObjectWithKey(block, 'polaris_timeline_connection');
    if (userObj && timeline) break;
  }

  if (!userObj) {
    if (isLoginWall(html)) return { status: 'login_wall' };
    if (isErrorPage(html)) return { status: 'error_page' };
    return { status: 'unrecognized' };
  }

  const og = parseOgCounts(html);
  const user: ParsedPublicUser = {
    pk: str(userObj.pk) || str(userObj.id),
    username: str(userObj.username),
    fullName: str(userObj.full_name),
    biography: str(userObj.biography),
    profilePicUrl: str(userObj.hd_profile_pic_url_info && (userObj.hd_profile_pic_url_info as { url?: string }).url) || str(userObj.profile_pic_url),
    isVerified: bool(userObj.is_verified),
    isPrivate: bool(userObj.is_private),
    followerCount: num(userObj.follower_count) ?? og.followers ?? 0,
    followingCount: num(userObj.following_count) ?? og.following ?? 0,
    mediaCount: num(userObj.media_count) ?? og.posts,
    externalUrl: str(userObj.external_url) || undefined,
    category: str(userObj.category) || undefined,
  };

  const connection = timeline ? (timeline.polaris_timeline_connection as { edges?: { node?: unknown }[]; page_info?: { has_next_page?: boolean; end_cursor?: string | null } }) : undefined;
  const media = (connection?.edges ?? []).map((edge) => parseTimelineNode(edge?.node)).filter((n): n is ParsedTimelineNode => n !== null);
  const endCursor = connection?.page_info?.has_next_page && connection.page_info.end_cursor ? connection.page_info.end_cursor : undefined;

  const lsd = html.match(/"LSD",\[\],\{"token":"([^"]+)"/)?.[1];
  const csrf = html.match(/"csrf_token":"([^"]+)"/)?.[1];

  return { status: 'ok', user, media, endCursor, lsd, csrf };
}

/** Parses the GraphQL response of `PolarisProfilePostsLoggedOutTabGridUIContentQuery` (pagination). */
export function parseTimelineResponse(json: unknown): { media: ParsedTimelineNode[]; endCursor?: string } | null {
  const timeline = findObjectWithKey(json, 'polaris_timeline_connection');
  if (!timeline) return null;
  const connection = timeline.polaris_timeline_connection as { edges?: { node?: unknown }[]; page_info?: { has_next_page?: boolean; end_cursor?: string | null } };
  const media = (connection.edges ?? []).map((edge) => parseTimelineNode(edge?.node)).filter((n): n is ParsedTimelineNode => n !== null);
  const endCursor = connection.page_info?.has_next_page && connection.page_info.end_cursor ? connection.page_info.end_cursor : undefined;
  return { media, endCursor };
}

/* ------------------------------------------------------------------ */
/* Embed page                                                           */
/* ------------------------------------------------------------------ */

/** Reads the JS string literal that follows `contextJSON":"` and returns its decoded JSON. */
function readContextJson(html: string): unknown | null {
  const marker = 'contextJSON":"';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  let literal = '';
  while (i < html.length) {
    const c = html[i];
    if (c === '\\') {
      literal += c + (html[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (c === '"') break;
    literal += c;
    i++;
  }
  try {
    const decoded = JSON.parse(`"${literal}"`) as string;
    return JSON.parse(decoded) as unknown;
  } catch {
    return null;
  }
}

function parseVisibleCount(html: string, words: string[]): number | undefined {
  for (const word of words) {
    const match = html.match(new RegExp(`([\\d][\\d.,]*\\s?(?:[KMB]|Mn|Bn)?)\\s+${word}`, 'i'));
    const value = parseCompactNumber(match?.[1]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Parses `https://www.instagram.com/p/<code>/embed/captioned/`. */
export function parseEmbedPage(html: string): ParsedEmbed | null {
  if (!html || html.length < 200) return null;
  const context = readContextJson(html) as { gql_data?: { shortcode_media?: Record<string, unknown> } } | null;
  const media = context?.gql_data?.shortcode_media;
  if (media) {
    const dims = media.dimensions as { width?: number; height?: number } | undefined;
    const caption = (media.edge_media_to_caption as { edges?: { node?: { text?: string } }[] } | undefined)?.edges?.[0]?.node?.text;
    const sidecar = (media.edge_sidecar_to_children as { edges?: { node?: Record<string, unknown> }[] } | undefined)?.edges;
    const audio = media.clips_music_attribution_info as { artist_name?: string; song_name?: string } | null | undefined;
    const music = audio && (audio.artist_name || audio.song_name) ? [audio.artist_name, audio.song_name].filter(Boolean).join(' · ') : undefined;
    const children = sidecar
      ?.map((edge) => edge.node)
      .filter((node): node is Record<string, unknown> => Boolean(node))
      .map((node) => ({
        id: str(node.id),
        isVideo: bool(node.is_video),
        displayUrl: str(node.display_url) || undefined,
        videoUrl: str(node.video_url) || undefined,
      }));
    return {
      shortcode: str(media.shortcode) || undefined,
      likeCount: num((media.edge_liked_by as { count?: number } | undefined)?.count) ?? num((media.edge_media_preview_like as { count?: number } | undefined)?.count),
      commentCount: num((media.edge_media_to_comment as { count?: number } | undefined)?.count) ?? num((media.edge_media_to_parent_comment as { count?: number } | undefined)?.count),
      viewCount: num(media.video_play_count) ?? num(media.video_view_count),
      videoDuration: num(media.video_duration),
      videoUrl: str(media.video_url) || undefined,
      displayUrl: str(media.display_url) || undefined,
      width: num(dims?.width),
      height: num(dims?.height),
      caption: typeof caption === 'string' ? caption : undefined,
      isVideo: bool(media.is_video),
      takenAt: num(media.taken_at_timestamp),
      music,
      children: children && children.length > 0 ? children : undefined,
      structured: true,
    };
  }

  // Photo embeds ship no structured payload; the counts are rendered as text ("14,568 likes", "85 comments").
  const likeCount = parseVisibleCount(html, ['likes?', 'beğen(?:me|i)']);
  const commentCount = parseVisibleCount(html, ['comments?', 'yorum']);
  const viewCount = parseVisibleCount(html, ['views?', 'görüntülenme', 'izlenme']);
  if (likeCount === undefined && commentCount === undefined && viewCount === undefined) return null;
  return { likeCount, commentCount, viewCount, structured: false };
}
