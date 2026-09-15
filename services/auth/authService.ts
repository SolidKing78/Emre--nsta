import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { API_URL, META_APP_ID, META_OAUTH_AUTHORIZE_URL, META_OAUTH_SCOPES, META_REDIRECT_URI } from '@/constants/config';
import { MOCK_USERNAME } from '@/mocks/mockData';
import { BackendSessionSchema } from '@/schemas/instagram';
import { httpJson } from '@/services/api/httpClient';
import { fetchPublicProfile, primePublicSnapshot, USERNAME_PATTERN } from '@/services/instagram/PublicInstagramProvider';
import { dropAllProviders } from '@/services/instagram/providerFactory';
import { buildAccountKey, useAuthStore, type AppSession } from '@/store/authStore';
import { useManualProfileStore, type ManualProfile } from '@/store/manualProfileStore';
import type { AppAccount } from '@/types/app';
import { AppError } from '@/types/errors';

WebBrowser.maybeCompleteAuthSession();

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function isLiveConfigured(): boolean {
  return Boolean(META_APP_ID && API_URL);
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

export function signInDemo(): AppSession {
  const session: AppSession = {
    source: 'demo',
    accountKey: buildAccountKey('demo', MOCK_USERNAME),
    username: MOCK_USERNAME,
    accountId: '17841400000000001',
    connectedAt: new Date().toISOString(),
  };
  useAuthStore.getState().signIn(session);
  return session;
}

/* ------------------------------------------------------------------ */
/* Public profile                                                       */
/* ------------------------------------------------------------------ */

export function normalizeUsernameInput(raw: string): string {
  return raw
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

/** Validates the username, fetches the public profile once (so errors surface before navigating) and signs in. */
export async function signInPublic(rawUsername: string): Promise<AppSession> {
  const username = normalizeUsernameInput(rawUsername);
  if (!USERNAME_PATTERN.test(username)) throw new AppError('not_found', 'invalid_username');
  const result = await fetchPublicProfile(username);
  const { account } = result;
  // The provider created right after sign-in reads this snapshot instead of fetching the page again.
  await primePublicSnapshot(account.username, result);
  const session: AppSession = {
    source: 'public',
    accountKey: buildAccountKey('public', account.username),
    username: account.username,
    accountId: account.id,
    connectedAt: new Date().toISOString(),
  };
  dropAllProviders();
  useManualProfileStore.getState().pushRecentPublic(account.username);
  useAuthStore.getState().signIn(session);
  return session;
}

/* ------------------------------------------------------------------ */
/* Manual profile                                                       */
/* ------------------------------------------------------------------ */

export function signInManual(profile: ManualProfile): AppSession {
  useManualProfileStore.getState().upsertProfile(profile);
  const session: AppSession = {
    source: 'manual',
    accountKey: buildAccountKey('manual', profile.id),
    username: profile.account.username,
    accountId: profile.id,
    connectedAt: profile.createdAt,
  };
  dropAllProviders();
  useAuthStore.getState().signIn(session);
  return session;
}

export function createManualAccount(input: {
  id: string;
  username: string;
  name: string;
  biography: string;
  website?: string;
  category?: string;
  profilePictureUrl: string;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
  isVerified: boolean;
}): AppAccount {
  return {
    id: input.id,
    username: input.username,
    name: input.name,
    biography: input.biography,
    website: input.website,
    profilePictureUrl: input.profilePictureUrl,
    accountType: 'BUSINESS',
    category: input.category,
    followersCount: input.followersCount,
    followsCount: input.followsCount,
    mediaCount: input.mediaCount,
    isVerified: input.isVerified,
    isPrivate: false,
    source: 'manual',
    connectedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Live — Instagram Business Login (code exchanged on the backend)      */
/* ------------------------------------------------------------------ */

async function randomString(bytes = 32): Promise<string> {
  const buffer = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64url for ASCII input (the state payload only ever contains a hex nonce and a URL). */
function base64UrlEncode(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 3) {
    const a = input.charCodeAt(i);
    const b = i + 1 < input.length ? input.charCodeAt(i + 1) : NaN;
    const c = i + 2 < input.length ? input.charCodeAt(i + 2) : NaN;
    const triple = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);
    out += BASE64[(triple >> 18) & 63]! + BASE64[(triple >> 12) & 63]!;
    out += Number.isNaN(b) ? '' : BASE64[(triple >> 6) & 63]!;
    out += Number.isNaN(c) ? '' : BASE64[triple & 63]!;
  }
  return out.split('+').join('-').split('/').join('_');
}

/** Where Instagram sends the browser: the backend bridge (HTTPS, as Meta requires) or a custom-scheme URI. */
export function liveRedirectUri(): string {
  return META_REDIRECT_URI;
}

/** Where the bridge sends the browser back to: `sociallens://oauth` in builds, `exp://…/--/oauth` in Expo Go. */
export function liveReturnUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'sociallens', path: 'oauth' });
}

/**
 * Opens the OFFICIAL Instagram authorization page. The app never sees credentials.
 * The resulting `code` is exchanged by the backend (which owns the app secret).
 * Works in Expo Go too, because the backend bridge turns Meta's HTTPS redirect
 * into the deep link carried inside `state`.
 */
export async function signInLive(): Promise<AppSession> {
  if (!isLiveConfigured()) throw new AppError('unknown', 'live_not_configured');

  const nonce = await randomString(16);
  const returnTo = liveReturnUri();
  const redirectUri = liveRedirectUri();
  const state = base64UrlEncode(JSON.stringify({ n: nonce, r: returnTo }));

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: META_OAUTH_SCOPES.join(','),
    state,
  });
  const authUrl = `${META_OAUTH_AUTHORIZE_URL}?${params.toString()}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnTo, { preferEphemeralSession: true });
  if (result.type !== 'success') throw new AppError('unknown', 'cancelled');

  const returned = new URL(result.url);
  const code = returned.searchParams.get('code');
  const returnedState = returned.searchParams.get('state');
  const errorReason = returned.searchParams.get('error_reason') ?? returned.searchParams.get('error');
  if (errorReason) throw new AppError('unknown', errorReason === 'user_denied' || errorReason === 'access_denied' ? 'cancelled' : errorReason);
  if (!code) throw new AppError('unknown', 'missing_code');
  if (returnedState !== state) throw new AppError('unknown', 'state_mismatch');

  // Instagram appends "#_" to the redirect; strip it.
  const cleanCode = code.replace(/#_$/, '');

  const json = await httpJson(`${API_URL}/auth/instagram/callback`, {
    method: 'POST',
    body: { code: cleanCode, state, redirect_uri: redirectUri },
    authAware: false,
  });
  const parsed = BackendSessionSchema.safeParse(json);
  if (!parsed.success) throw new AppError('invalid_response', 'Session payload failed validation');

  const { account, session_token, expires_at } = parsed.data;
  const session: AppSession = {
    source: 'live',
    accountKey: buildAccountKey('live', account.id),
    username: account.username,
    accountId: account.id,
    sessionToken: session_token,
    connectedAt: account.connected_at ?? new Date().toISOString(),
    tokenExpiresAt: account.token_expires_at ?? expires_at,
  };
  dropAllProviders();
  useAuthStore.getState().signIn(session);
  return session;
}

export async function signOut(): Promise<void> {
  const { session } = useAuthStore.getState();
  if (session?.source === 'live' && session.sessionToken && API_URL) {
    try {
      await httpJson(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.sessionToken}` },
        authAware: false,
      });
    } catch {
      // Best effort — local sign-out always succeeds.
    }
  }
  dropAllProviders();
  useAuthStore.getState().signOut();
}
