/**
 * Single source of truth for runtime configuration read from EXPO_PUBLIC_* env.
 * No secrets live here — everything in this file ships inside the app bundle.
 */

export type AppMode = 'demo' | 'live';

const rawMode = (process.env.EXPO_PUBLIC_APP_MODE ?? 'demo').toLowerCase();

export const APP_MODE: AppMode = rawMode === 'live' ? 'live' : 'demo';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export const META_APP_ID = process.env.EXPO_PUBLIC_META_APP_ID ?? '';

export const META_REDIRECT_URI = process.env.EXPO_PUBLIC_META_REDIRECT_URI ?? 'sociallens://oauth';

export const PUBLIC_PROFILE_PROXY_URL = (
  process.env.EXPO_PUBLIC_PUBLIC_PROFILE_PROXY_URL ?? ''
).replace(/\/+$/, '');

/** Kept in ONE place; never hard-code inside endpoint strings. */
export const META_GRAPH_API_VERSION = 'v23.0';

export const META_OAUTH_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';

/**
 * Minimum permission set for read-only insights.
 * Do NOT add publish / comments scopes unless a feature really needs them.
 */
export const META_OAUTH_SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'] as const;

export const APP_NAME = 'SocialLens';
export const APP_TAGLINE = 'Professional Social Analytics';

export const CACHE_TIMES = {
  profile: 10 * 60 * 1000,
  media: 5 * 60 * 1000,
  insights: 15 * 60 * 1000,
} as const;

export const isLiveMode = APP_MODE === 'live';
export const isDemoMode = APP_MODE === 'demo';
