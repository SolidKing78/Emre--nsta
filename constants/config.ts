/**
 * Single source of truth for runtime configuration read from EXPO_PUBLIC_* env.
 * No secrets live here — everything in this file ships inside the app bundle.
 */

export type AppMode = 'demo' | 'live';

const rawMode = (process.env.EXPO_PUBLIC_APP_MODE ?? 'demo').toLowerCase();

export const APP_MODE: AppMode = rawMode === 'live' ? 'live' : 'demo';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export const META_APP_ID = process.env.EXPO_PUBLIC_META_APP_ID ?? '';

/**
 * OAuth redirect URI registered in the Meta console. Meta only accepts HTTPS, so the
 * default is the backend bridge (`/auth/instagram/redirect`), which deep-links back
 * into the app — this is what makes Instagram login work in Expo Go as well.
 */
export const META_REDIRECT_URI = process.env.EXPO_PUBLIC_META_REDIRECT_URI || (API_URL ? `${API_URL}/auth/instagram/redirect` : 'sociallens://oauth');

export const PUBLIC_PROFILE_PROXY_URL = (
  process.env.EXPO_PUBLIC_PUBLIC_PROFILE_PROXY_URL ?? ''
).replace(/\/+$/, '');

/** Kept in ONE place; never hard-code inside endpoint strings. */
export const META_GRAPH_API_VERSION = 'v23.0';

export const META_OAUTH_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';

/**
 * Minimum permission set: profile + insights, plus READ access to comments for the
 * comments sheet. No publishing / messaging scopes.
 */
export const META_OAUTH_SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights', 'instagram_business_manage_comments'] as const;

export const APP_NAME = 'SocialLens';
export const APP_TAGLINE = 'Professional Social Analytics';

export const CACHE_TIMES = {
  profile: 10 * 60 * 1000,
  media: 5 * 60 * 1000,
  insights: 15 * 60 * 1000,
} as const;

export const isLiveMode = APP_MODE === 'live';
export const isDemoMode = APP_MODE === 'demo';
