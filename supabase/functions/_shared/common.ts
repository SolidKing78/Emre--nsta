// Shared helpers for SocialLens edge functions (Deno / Supabase).
// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const META_GRAPH_API_VERSION = Deno.env.get('META_GRAPH_API_VERSION') ?? 'v23.0';
export const GRAPH_BASE = `https://graph.instagram.com/${META_GRAPH_API_VERSION}`;

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
  });
}

export function corsHeaders(): Record<string, string> {
  const allowed = Deno.env.get('ALLOWED_ORIGINS') ?? '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ------------------------------------------------------------------ */
/* Crypto: AES-256-GCM for Instagram tokens, SHA-256 for session tokens */
/* ------------------------------------------------------------------ */

async function encryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY missing (32-byte base64)');
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

export async function encryptToken(plain: string): Promise<string> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return toBase64(out);
}

export async function decryptToken(encoded: string): Promise<string> {
  const key = await encryptionKey();
  const bytes = fromBase64(encoded);
  const iv = bytes.slice(0, 12);
  const cipher = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* Rate limiting (fixed window, stored in Postgres)                     */
/* ------------------------------------------------------------------ */

export async function rateLimit(db: SupabaseClient, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const { data } = await db.from('rate_limits').select('window_start,count').eq('key', key).maybeSingle();
  if (!data || now.getTime() - new Date(data.window_start).getTime() > windowSeconds * 1000) {
    await db.from('rate_limits').upsert({ key, window_start: now.toISOString(), count: 1 });
    return true;
  }
  if (data.count >= limit) return false;
  await db.from('rate_limits').update({ count: data.count + 1 }).eq('key', key);
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
}

/* ------------------------------------------------------------------ */
/* Sessions                                                             */
/* ------------------------------------------------------------------ */

export interface SessionContext {
  userId: string;
  accountRowId: string;
  instagramAccountId: string;
  username: string;
  accessToken: string;
  tokenExpiresAt: string | null;
}

export async function requireSession(req: Request, db: SupabaseClient): Promise<SessionContext | Response> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json({ error: 'Missing session' }, 401);
  const hash = await sha256(token);
  const { data: session } = await db.from('app_sessions').select('*').eq('token_hash', hash).maybeSingle();
  if (!session) return json({ error: 'Invalid session' }, 401);
  if (new Date(session.expires_at).getTime() < Date.now()) return json({ error: 'Session expired' }, 401);
  const { data: account } = await db.from('instagram_accounts').select('*').eq('id', session.instagram_account_id).maybeSingle();
  if (!account) return json({ error: 'Account not found' }, 404);
  if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now()) {
    return json({ error: 'Instagram authorization expired' }, 401);
  }
  await db.from('app_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.id);
  return {
    userId: session.user_id,
    accountRowId: account.id,
    instagramAccountId: account.instagram_account_id,
    username: account.username,
    accessToken: await decryptToken(account.token_encrypted),
    tokenExpiresAt: account.token_expires_at,
  };
}

/* ------------------------------------------------------------------ */
/* Meta Graph API proxy helper                                          */
/* ------------------------------------------------------------------ */

export async function graphGet(path: string, params: Record<string, string>, accessToken: string): Promise<{ status: number; body: any }> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/** Maps Meta error codes to the status codes the mobile client understands. */
export function mapGraphError(status: number, body: any): Response {
  const code = body?.error?.code;
  const message = body?.error?.message ?? 'Instagram API error';
  if (code === 190) return json({ error: message, code: 'auth_expired' }, 401);
  if (code === 10 || code === 200) return json({ error: `permission: ${message}`, code: 'insufficient_permission' }, 403);
  if (code === 4 || code === 17 || code === 32 || status === 429) return json({ error: message, code: 'rate_limit' }, 429);
  if (status === 404) return json({ error: message, code: 'not_found' }, 404);
  return json({ error: message, code: 'unknown' }, status >= 400 ? status : 502);
}
