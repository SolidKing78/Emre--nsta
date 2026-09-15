// SocialLens — auth edge function
//   POST /auth/instagram/callback  { code, state, code_verifier, redirect_uri }
//   POST /auth/logout              (Bearer session)
//
// Exchanges the OAuth code for an Instagram token (short → long lived), encrypts it,
// stores it, and returns an opaque app session. The App Secret never leaves the server.
// deno-lint-ignore-file no-explicit-any
import {
  clientIp,
  corsHeaders,
  encryptToken,
  graphGet,
  json,
  mapGraphError,
  randomToken,
  rateLimit,
  serviceClient,
  sha256,
} from '../_shared/common.ts';

const META_APP_ID = Deno.env.get('META_APP_ID') ?? '';
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') ?? '';
const ALLOWED_REDIRECTS = (Deno.env.get('META_ALLOWED_REDIRECT_URIS') ?? 'sociallens://oauth').split(',').map((s) => s.trim());
const SESSION_TTL_DAYS = Number(Deno.env.get('SESSION_TTL_DAYS') ?? '30');

async function exchangeCode(code: string, redirectUri: string, codeVerifier?: string) {
  // 1) short-lived token (Instagram Login)
  const form = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  if (codeVerifier) form.set('code_verifier', codeVerifier);
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form });
  const shortBody: any = await shortRes.json().catch(() => ({}));
  if (!shortRes.ok || !shortBody.access_token) {
    throw new Error(shortBody?.error_message ?? shortBody?.error?.message ?? 'Code exchange failed');
  }

  // 2) long-lived token (60 days)
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', META_APP_SECRET);
  longUrl.searchParams.set('access_token', shortBody.access_token);
  const longRes = await fetch(longUrl.toString());
  const longBody: any = await longRes.json().catch(() => ({}));
  const accessToken: string = longBody.access_token ?? shortBody.access_token;
  const expiresIn: number = longBody.expires_in ?? 3600;
  return { accessToken, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(), igUserId: String(shortBody.user_id ?? '') };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/auth/, '');
  const db = serviceClient();

  if (req.method === 'POST' && path === '/instagram/callback') {
    if (!(await rateLimit(db, `ip:${clientIp(req)}:auth`, 10, 60))) return json({ error: 'Too many requests' }, 429);
    if (!META_APP_ID || !META_APP_SECRET) return json({ error: 'Server not configured' }, 500);
    const body = await req.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code : '';
    const redirectUri = typeof body?.redirect_uri === 'string' ? body.redirect_uri : '';
    const codeVerifier = typeof body?.code_verifier === 'string' ? body.code_verifier : undefined;
    if (!code || !redirectUri) return json({ error: 'code and redirect_uri required' }, 400);
    if (!ALLOWED_REDIRECTS.includes(redirectUri)) return json({ error: 'redirect_uri not allowed' }, 400);

    let exchanged;
    try {
      exchanged = await exchangeCode(code, redirectUri, codeVerifier);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'exchange failed' }, 400);
    }

    // Fetch the profile with the fresh token.
    const me = await graphGet('/me', { fields: 'id,user_id,username,name,biography,website,profile_picture_url,account_type,media_count,followers_count,follows_count' }, exchanged.accessToken);
    if (me.status >= 400) return mapGraphError(me.status, me.body);
    const profile = me.body;
    const accountType = profile.account_type === 'MEDIA_CREATOR' ? 'CREATOR' : ['BUSINESS', 'CREATOR', 'PERSONAL'].includes(profile.account_type) ? profile.account_type : 'UNKNOWN';
    if (accountType === 'PERSONAL') return json({ error: 'Professional account required', code: 'not_professional' }, 403);

    // Upsert user + account.
    const igId = String(profile.id ?? exchanged.igUserId);
    const { data: existing } = await db.from('instagram_accounts').select('id,user_id').eq('instagram_account_id', igId).maybeSingle();
    let userId = existing?.user_id as string | undefined;
    if (!userId) {
      const { data: user, error } = await db.from('users').insert({}).select('id').single();
      if (error || !user) return json({ error: 'Could not create user' }, 500);
      userId = user.id;
    }
    const tokenEncrypted = await encryptToken(exchanged.accessToken);
    const accountRow = {
      user_id: userId,
      instagram_account_id: igId,
      username: profile.username,
      name: profile.name ?? null,
      profile_picture_url: profile.profile_picture_url ?? null,
      account_type: accountType,
      media_count: profile.media_count ?? 0,
      followers_count: profile.followers_count ?? 0,
      follows_count: profile.follows_count ?? 0,
      token_encrypted: tokenEncrypted,
      token_expires_at: exchanged.expiresAt,
      last_sync_at: new Date().toISOString(),
    };
    const { data: account, error: accountError } = await db
      .from('instagram_accounts')
      .upsert(accountRow, { onConflict: 'instagram_account_id' })
      .select('*')
      .single();
    if (accountError || !account) return json({ error: 'Could not store account' }, 500);

    // Issue an opaque app session (only its hash is stored).
    const sessionToken = randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
    await db.from('app_sessions').insert({
      user_id: userId,
      instagram_account_id: account.id,
      token_hash: await sha256(sessionToken),
      expires_at: expiresAt,
    });

    return json({
      session_token: sessionToken,
      expires_at: expiresAt,
      account: {
        id: igId,
        username: account.username,
        name: account.name ?? undefined,
        biography: profile.biography ?? undefined,
        website: profile.website ?? undefined,
        profile_picture_url: account.profile_picture_url ?? undefined,
        account_type: account.account_type,
        media_count: account.media_count,
        followers_count: account.followers_count,
        follows_count: account.follows_count,
        token_expires_at: account.token_expires_at,
        connected_at: account.connected_at,
      },
    });
  }

  if (req.method === 'POST' && path === '/logout') {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token) await db.from('app_sessions').delete().eq('token_hash', await sha256(token));
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
});
