// SocialLens — Instagram read-only proxy (Bearer app session required)
//   GET /instagram/account
//   GET /instagram/media?after=<cursor>
//   GET /instagram/media/:id
//   GET /instagram/media/:id/comments
//   GET /instagram/insights/account?since=YYYY-MM-DD&until=YYYY-MM-DD
//   GET /instagram/insights/media/:id
//   GET /instagram/insights/audience   (follower demographics; needs ≥100 followers)
//
// Never exposes the Instagram access token. Never writes to Instagram.
// Refreshes long-lived tokens that are close to expiry and records metric snapshots.
// deno-lint-ignore-file no-explicit-any
import {
  clientIp,
  corsHeaders,
  encryptToken,
  graphGet,
  json,
  mapGraphError,
  rateLimit,
  requireSession,
  serviceClient,
  type SessionContext,
} from '../_shared/common.ts';

const ACCOUNT_FIELDS = 'id,user_id,username,name,biography,website,profile_picture_url,account_type,media_count,followers_count,follows_count';
const MEDIA_FIELDS = 'id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count,username,children{id,media_type,media_url,thumbnail_url}';

/** Metrics per Meta docs; unsupported ones are requested separately so one failure does not break the rest. */
const ACCOUNT_TOTAL_METRICS = ['views', 'reach', 'total_interactions', 'accounts_engaged', 'profile_views', 'website_clicks', 'likes', 'comments', 'shares', 'saves', 'follows_and_unfollows'];
const ACCOUNT_SERIES_METRICS = ['reach', 'views'];
const FOLLOWER_METRICS = ['follower_count'];
const MEDIA_METRICS_DEFAULT = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'follows', 'profile_visits'];
const MEDIA_METRICS_REEL = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'replays'];

async function maybeRefreshToken(db: any, ctx: SessionContext): Promise<string> {
  if (!ctx.tokenExpiresAt) return ctx.accessToken;
  const daysLeft = (new Date(ctx.tokenExpiresAt).getTime() - Date.now()) / 86_400_000;
  if (daysLeft > 7) return ctx.accessToken;
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', ctx.accessToken);
  const res = await fetch(url.toString());
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) return ctx.accessToken;
  await db
    .from('instagram_accounts')
    .update({
      token_encrypted: await encryptToken(body.access_token),
      token_expires_at: new Date(Date.now() + (body.expires_in ?? 5_184_000) * 1000).toISOString(),
    })
    .eq('id', ctx.accountRowId);
  return body.access_token;
}

async function snapshotMetrics(db: any, accountRowId: string, mediaId: string | null, metrics: any[]) {
  const rows = metrics
    .map((m) => ({
      instagram_account_id: accountRowId,
      instagram_media_id: mediaId,
      metric_name: m.name,
      metric_value: m.total_value?.value ?? m.values?.[m.values.length - 1]?.value ?? null,
    }))
    .filter((r) => typeof r.metric_value === 'number');
  if (rows.length) await db.from('metric_snapshots').insert(rows);
}

/** Requests metrics one group at a time so an unsupported metric never blanks the response. */
async function collectInsights(path: string, base: Record<string, string>, metricGroups: string[][], token: string): Promise<any[]> {
  const out: any[] = [];
  for (const group of metricGroups) {
    const res = await graphGet(path, { ...base, metric: group.join(',') }, token);
    if (res.status < 400 && Array.isArray(res.body?.data)) {
      out.push(...res.body.data);
      continue;
    }
    // Retry each metric individually to keep the supported ones.
    for (const metric of group) {
      const single = await graphGet(path, { ...base, metric }, token);
      if (single.status < 400 && Array.isArray(single.body?.data)) out.push(...single.body.data);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const db = serviceClient();
  if (!(await rateLimit(db, `ip:${clientIp(req)}:instagram`, 120, 60))) return json({ error: 'Too many requests' }, 429);

  const session = await requireSession(req, db);
  if (session instanceof Response) return session;
  const token = await maybeRefreshToken(db, session);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/instagram/, '');

  if (path === '/account') {
    const res = await graphGet('/me', { fields: ACCOUNT_FIELDS }, token);
    if (res.status >= 400) return mapGraphError(res.status, res.body);
    const { data: row } = await db
      .from('instagram_accounts')
      .update({
        username: res.body.username,
        name: res.body.name ?? null,
        profile_picture_url: res.body.profile_picture_url ?? null,
        media_count: res.body.media_count ?? 0,
        followers_count: res.body.followers_count ?? 0,
        follows_count: res.body.follows_count ?? 0,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', session.accountRowId)
      .select('token_expires_at,connected_at,last_sync_at')
      .single();
    return json({ ...res.body, token_expires_at: row?.token_expires_at, connected_at: row?.connected_at, last_sync_at: row?.last_sync_at });
  }

  if (path === '/media') {
    const params: Record<string, string> = { fields: MEDIA_FIELDS, limit: '25' };
    const after = url.searchParams.get('after');
    if (after) params.after = after;
    const res = await graphGet('/me/media', params, token);
    if (res.status >= 400) return mapGraphError(res.status, res.body);
    const items: any[] = res.body.data ?? [];
    if (items.length) {
      await db.from('media_snapshots').upsert(
        items.map((m) => ({
          instagram_account_id: session.accountRowId,
          instagram_media_id: m.id,
          media_type: m.media_product_type === 'REELS' ? 'REEL' : ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'].includes(m.media_type) ? m.media_type : 'UNKNOWN',
          permalink: m.permalink ?? null,
          thumbnail_url: m.thumbnail_url ?? null,
          media_url: m.media_url ?? null,
          caption: m.caption ?? null,
          timestamp: m.timestamp ?? null,
        })),
        { onConflict: 'instagram_account_id,instagram_media_id' },
      );
    }
    return json(res.body);
  }

  const commentsMatch = path.match(/^\/media\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const res = await graphGet(`/${commentsMatch[1]}/comments`, { fields: 'id,text,username,timestamp,like_count,replies{id}', limit: '50' }, token);
    if (res.status >= 400) return mapGraphError(res.status, res.body);
    const data = (Array.isArray(res.body?.data) ? res.body.data : []).map((c: any) => ({
      id: String(c.id),
      text: c.text ?? '',
      username: c.username ?? '',
      timestamp: c.timestamp ?? null,
      like_count: c.like_count ?? 0,
      reply_count: Array.isArray(c.replies?.data) ? c.replies.data.length : 0,
    }));
    return json({ data });
  }

  const mediaMatch = path.match(/^\/media\/([^/]+)$/);
  if (mediaMatch) {
    const res = await graphGet(`/${mediaMatch[1]}`, { fields: MEDIA_FIELDS }, token);
    if (res.status >= 400) return mapGraphError(res.status, res.body);
    return json(res.body);
  }

  if (path === '/insights/account') {
    const since = url.searchParams.get('since');
    const until = url.searchParams.get('until');
    if (!since || !until) return json({ error: 'since and until required' }, 400);
    const base = { period: 'day', since, until, metric_type: 'total_value' };
    const totals = await collectInsights('/me/insights', base, [ACCOUNT_TOTAL_METRICS], token);
    const series = await collectInsights('/me/insights', { period: 'day', since, until }, [ACCOUNT_SERIES_METRICS], token);
    const followers = await collectInsights('/me/insights', { period: 'day', since, until }, [FOLLOWER_METRICS], token);
    // Merge: keep series versions for reach/views when available.
    const byName = new Map<string, any>();
    for (const m of totals) byName.set(m.name, m);
    for (const m of [...series, ...followers]) byName.set(m.name, { ...(byName.get(m.name) ?? {}), ...m });
    const data = [...byName.values()];
    await snapshotMetrics(db, session.accountRowId, null, data);
    return json({ data });
  }

  const insightsMatch = path.match(/^\/insights\/media\/([^/]+)$/);
  if (insightsMatch) {
    const mediaId = insightsMatch[1]!;
    const meta = await graphGet(`/${mediaId}`, { fields: 'media_type,media_product_type' }, token);
    if (meta.status >= 400) return mapGraphError(meta.status, meta.body);
    const isReel = meta.body.media_product_type === 'REELS';
    const data = await collectInsights(`/${mediaId}/insights`, {}, [isReel ? MEDIA_METRICS_REEL : MEDIA_METRICS_DEFAULT], token);
    await snapshotMetrics(db, session.accountRowId, mediaId, data);
    return json({ data });
  }

  if (path === '/insights/audience') {
    // Percent shares per breakdown. Instagram returns raw follower counts per dimension.
    const breakdown = async (dimension: string): Promise<{ label: string; value: number }[]> => {
      const res = await graphGet('/me/insights', { metric: 'follower_demographics', period: 'lifetime', timeframe: 'this_month', metric_type: 'total_value', breakdown: dimension }, token);
      const results: any[] = res.body?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      const total = results.reduce((acc, r) => acc + (Number(r.value) || 0), 0) || 1;
      return results
        .map((r) => ({ label: String(r.dimension_values?.[0] ?? ''), value: Math.round(((Number(r.value) || 0) / total) * 1000) / 10 }))
        .sort((a, b) => b.value - a.value);
    };
    const [ages, gender, cities, countries] = await Promise.all([breakdown('age'), breakdown('gender'), breakdown('city'), breakdown('country')]);
    if (ages.length === 0 && gender.length === 0) return json({ error: 'Demographics unavailable', code: 'unsupported_metric' }, 404);
    const women = gender.find((g) => g.label === 'F')?.value ?? 0;
    const men = gender.find((g) => g.label === 'M')?.value ?? 0;

    // Share of views that came from followers (last 30 days).
    let followerShare: number | undefined;
    const until = new Date();
    const since = new Date(until.getTime() - 30 * 86_400_000);
    const views = await graphGet('/me/insights', { metric: 'views', period: 'day', metric_type: 'total_value', breakdown: 'follower_type', since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) }, token);
    const viewResults: any[] = views.body?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    if (viewResults.length) {
      const total = viewResults.reduce((acc, r) => acc + (Number(r.value) || 0), 0) || 1;
      const followers = viewResults.find((r) => String(r.dimension_values?.[0]).toUpperCase() === 'FOLLOWER');
      followerShare = Math.round(((Number(followers?.value) || 0) / total) * 1000) / 1000;
    }

    // Hourly activity (0-23), normalised to 0..1. Not every account type exposes it.
    let activeHours: number[] | undefined;
    const online = await graphGet('/me/insights', { metric: 'online_followers', period: 'lifetime' }, token);
    const hourly = online.body?.data?.[0]?.values?.[0]?.value;
    if (hourly && typeof hourly === 'object') {
      const raw = Array.from({ length: 24 }, (_, h) => Number(hourly[String(h)]) || 0);
      const max = Math.max(...raw) || 1;
      activeHours = raw.map((v) => Math.round((v / max) * 1000) / 1000);
    }

    return json({ follower_share: followerShare, gender: { women, men }, ages, cities: cities.slice(0, 5), countries: countries.slice(0, 5), active_hours: activeHours });
  }

  return json({ error: 'Not found' }, 404);
});
