// SocialLens — public profile proxy
//   GET /public-profile?username=<username>
//
// Fallback used by the app when Instagram's public web endpoint rate-limits the device.
// Runs the same read-only request from the server, caches responses briefly, and
// optionally delegates to a third-party provider (RapidAPI) when configured.
// deno-lint-ignore-file no-explicit-any
import { clientIp, corsHeaders, json, rateLimit, serviceClient } from '../_shared/common.ts';

const IG_APP_ID = '936619743392459';
const USERNAME = /^[a-zA-Z0-9._]{1,30}$/;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();

async function fetchFromInstagram(username: string): Promise<{ status: number; body: any; text: string }> {
  const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
    headers: {
      'x-ig-app-id': IG_APP_ID,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `https://www.instagram.com/${username}/`,
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: res.status, body, text };
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

  const direct = await fetchFromInstagram(username);
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

  if (direct.status === 429) return json({ error: 'Instagram rate limit', code: 'rate_limit' }, 429);
  return json({ error: 'Instagram requires login for this request', code: 'login_required' }, 502);
});
