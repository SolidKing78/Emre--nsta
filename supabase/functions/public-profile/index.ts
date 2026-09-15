// SocialLens — public profile proxy
//   GET /public-profile?username=<username>
//
// Fallback used by the app when Instagram blocks the device directly. Runs the
// same read-only requests from the server (mobile HTML page + per-post embed
// pages), caches responses briefly and returns Instagram's classic
// `{ data: { user } }` shape so the app parses it with the same schema it uses
// for `web_profile_info`. Optionally delegates to a third-party provider.
// deno-lint-ignore-file no-explicit-any
import { clientIp, corsHeaders, json, rateLimit, serviceClient } from '../_shared/common.ts';
import { parseEmbedPage, parseProfilePage, timestampFromMediaId, type ParsedEmbed, type ParsedTimelineNode } from '../_shared/publicWebParser.ts';

const IG_APP_ID = '936619743392459';
const USERNAME = /^[a-zA-Z0-9._]{1,30}$/;
const CACHE_TTL_MS = 10 * 60 * 1000;
const EMBED_CONCURRENCY = 4;
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const HTML_HEADERS = {
  'User-Agent': MOBILE_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const cache = new Map<string, { at: number; body: unknown }>();

async function fetchText(url: string, headers: Record<string, string>, timeoutMs = 12_000): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    return { status: res.status, text: await res.text() };
  } catch {
    return { status: 0, text: '' };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- HTML page → { data: { user } } ---------------- */

async function fetchEmbed(code: string): Promise<ParsedEmbed | null> {
  const res = await fetchText(`https://www.instagram.com/p/${encodeURIComponent(code)}/embed/captioned/`, { ...HTML_HEADERS, Referer: 'https://www.instagram.com/' }, 9_000);
  if (res.status !== 200) return null;
  return parseEmbedPage(res.text);
}

async function enrich(nodes: ParsedTimelineNode[]): Promise<Map<string, ParsedEmbed>> {
  const out = new Map<string, ParsedEmbed>();
  let cursor = 0;
  let failures = 0;
  const worker = async () => {
    while (cursor < nodes.length && failures < 3) {
      const node = nodes[cursor++];
      if (!node?.code) continue;
      const embed = await fetchEmbed(node.code);
      if (embed) out.set(node.pk, embed);
      else failures += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(EMBED_CONCURRENCY, nodes.length) }, () => worker()));
  return out;
}

function toLegacyNode(node: ParsedTimelineNode, embed: ParsedEmbed | undefined) {
  const isVideo = node.kind === 'video';
  const takenAt = embed?.takenAt ?? node.takenAt ?? Math.floor((timestampFromMediaId(node.pk) ?? Date.now()) / 1000);
  const likeCount = embed?.likeCount ?? node.likeCount;
  const commentCount = embed?.commentCount ?? node.commentCount;
  return {
    id: node.pk,
    shortcode: node.code,
    __typename: node.kind === 'carousel' ? 'GraphSidecar' : isVideo ? 'GraphVideo' : 'GraphImage',
    product_type: node.productType,
    display_url: node.imageUrl,
    thumbnail_src: node.imageUrl,
    is_video: isVideo,
    video_view_count: isVideo ? (embed?.viewCount ?? node.viewCount) : undefined,
    video_url: embed?.videoUrl,
    video_duration: embed?.videoDuration,
    taken_at_timestamp: takenAt,
    edge_liked_by: { count: likeCount ?? 0 },
    edge_media_to_comment: { count: commentCount ?? 0 },
    edge_media_to_caption: { edges: [{ node: { text: node.caption || embed?.caption || '' } }] },
    dimensions: node.width && node.height ? { width: node.width, height: node.height } : embed?.width && embed?.height ? { width: embed.width, height: embed.height } : undefined,
    pinned_for_users: node.isPinned ? [{}] : [],
    edge_sidecar_to_children: embed?.children ? { edges: embed.children.map((c) => ({ node: { id: c.id, display_url: c.displayUrl, is_video: c.isVideo, video_url: c.videoUrl } })) } : undefined,
    counts_estimated: likeCount === undefined && commentCount === undefined,
  };
}

async function fetchFromHtml(username: string): Promise<{ status: 'ok'; body: unknown } | { status: 'not_found' | 'blocked' | 'rate_limit' }> {
  const res = await fetchText(`https://www.instagram.com/${encodeURIComponent(username)}/`, HTML_HEADERS, 15_000);
  if (res.status === 404) return { status: 'not_found' };
  if (res.status === 429) return { status: 'rate_limit' };
  if (res.status !== 200) return { status: 'blocked' };
  const parsed = parseProfilePage(res.text);
  if (parsed.status === 'error_page') return { status: 'not_found' };
  if (parsed.status !== 'ok') return { status: 'blocked' };

  const embeds = await enrich(parsed.media.filter((m) => m.likeCount === undefined));
  const user = {
    id: parsed.user.pk,
    username: parsed.user.username,
    full_name: parsed.user.fullName,
    biography: parsed.user.biography,
    external_url: parsed.user.externalUrl ?? null,
    profile_pic_url: parsed.user.profilePicUrl,
    profile_pic_url_hd: parsed.user.profilePicUrl,
    is_private: parsed.user.isPrivate,
    is_verified: parsed.user.isVerified,
    is_business_account: false,
    is_professional_account: Boolean(parsed.user.category),
    category_name: parsed.user.category ?? null,
    edge_followed_by: { count: parsed.user.followerCount },
    edge_follow: { count: parsed.user.followingCount },
    edge_owner_to_timeline_media: {
      count: parsed.user.mediaCount ?? parsed.media.length,
      page_info: { has_next_page: Boolean(parsed.endCursor), end_cursor: parsed.endCursor ?? null },
      edges: parsed.media.map((node) => ({ node: toLegacyNode(node, embeds.get(node.pk)) })),
    },
  };
  return { status: 'ok', body: { data: { user }, status: 'ok', source: 'html' } };
}

/* ---------------- JSON endpoint (secondary) ---------------- */

async function fetchFromInstagramJson(username: string): Promise<{ status: number; body: any }> {
  const res = await fetchText(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
    'x-ig-app-id': IG_APP_ID,
    'User-Agent': MOBILE_UA,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `https://www.instagram.com/${username}/`,
  });
  let body: any = null;
  try {
    body = JSON.parse(res.text);
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/** Optional: RapidAPI-style provider returning the same `data.user` shape. */
async function fetchFromProvider(username: string): Promise<any | null> {
  const endpoint = Deno.env.get('PUBLIC_PROFILE_PROVIDER_URL');
  const key = Deno.env.get('PUBLIC_PROFILE_PROVIDER_KEY');
  const host = Deno.env.get('PUBLIC_PROFILE_PROVIDER_HOST');
  if (!endpoint || !key) return null;
  const res = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}username=${encodeURIComponent(username)}`, {
    headers: { 'x-rapidapi-key': key, ...(host ? { 'x-rapidapi-host': host } : {}) },
  });
  if (!res.ok) return null;
  const body: any = await res.json().catch(() => null);
  if (body?.data?.user) return body;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  const url = new URL(req.url);
  const username = (url.searchParams.get('username') ?? '').trim().toLowerCase();
  if (!USERNAME.test(username)) return json({ error: 'Invalid username', code: 'not_found' }, 400);

  const db = serviceClient();
  if (!(await rateLimit(db, `ip:${clientIp(req)}:public-profile`, 30, 60))) return json({ error: 'Too many requests', code: 'rate_limit' }, 429);

  const cached = cache.get(username);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return json(cached.body);

  const html = await fetchFromHtml(username);
  if (html.status === 'ok') {
    cache.set(username, { at: Date.now(), body: html.body });
    return json(html.body);
  }
  if (html.status === 'not_found') return json({ error: 'Not found', code: 'not_found' }, 404);

  const direct = await fetchFromInstagramJson(username);
  if (direct.status === 200 && direct.body?.data) {
    if (!direct.body.data.user) return json({ error: 'Not found', code: 'not_found' }, 404);
    cache.set(username, { at: Date.now(), body: direct.body });
    return json(direct.body);
  }
  if (direct.status === 404) return json({ error: 'Not found', code: 'not_found' }, 404);

  const provider = await fetchFromProvider(username);
  if (provider) {
    cache.set(username, { at: Date.now(), body: provider });
    return json(provider);
  }

  if (html.status === 'rate_limit' || direct.status === 429) return json({ error: 'Instagram rate limit', code: 'rate_limit' }, 429);
  return json({ error: 'Instagram requires login for this request', code: 'login_required' }, 502);
});
