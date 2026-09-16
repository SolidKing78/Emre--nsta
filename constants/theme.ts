/**
 * SocialLens design tokens.
 * Instagram-like feel (edge-to-edge media, 1px dividers, true-black dark mode)
 * without copying Instagram brand assets.
 */

import { fontStyleForWeight } from './fonts';

/** See `letterSpacingFor` — Instagram's text is very slightly wider than Inter's default. */
const TRACKING = 0;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * Text scale. Every entry carries the family together with its weight, because Android
 * picks the cut by family name rather than by `fontWeight`.
 */
export const typography = {
  display: { fontSize: 28, lineHeight: 34, letterSpacing: TRACKING, ...fontStyleForWeight('700') },
  heading: { fontSize: 18, lineHeight: 24, letterSpacing: TRACKING, ...fontStyleForWeight('600') },
  title: { fontSize: 16, lineHeight: 22, letterSpacing: TRACKING, ...fontStyleForWeight('600') },
  body: { fontSize: 15, lineHeight: 20, letterSpacing: TRACKING, ...fontStyleForWeight('400') },
  bodyStrong: { fontSize: 15, lineHeight: 20, letterSpacing: TRACKING, ...fontStyleForWeight('600') },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: TRACKING, ...fontStyleForWeight('400') },
  captionStrong: { fontSize: 13, lineHeight: 18, letterSpacing: TRACKING, ...fontStyleForWeight('600') },
  small: { fontSize: 11, lineHeight: 14, letterSpacing: TRACKING, ...fontStyleForWeight('400') },
  metric: { fontSize: 28, lineHeight: 34, letterSpacing: TRACKING, ...fontStyleForWeight('700') },
  feed: { fontSize: 14, lineHeight: 18, letterSpacing: TRACKING, ...fontStyleForWeight('400') },
  feedStrong: { fontSize: 14, lineHeight: 18, letterSpacing: TRACKING, ...fontStyleForWeight('600') },
} as const;

/**
 * Tracking for the whole app.
 *
 * Measured rather than guessed: the same strings were cut out of a screen recording of
 * Instagram and rendered in Inter at a matching ink height. Instagram's text came out
 * 0.8 % (15px regular) to 2.7 % (20px bold) *wider* than Inter's default spacing — so
 * tightening it, which is the usual reflex for a grotesque, walks away from Instagram.
 * Neutral spacing lands within ~1 % of it. Don't make this negative again.
 */
export function letterSpacingFor(_fontSize: number): number {
  return TRACKING;
}

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  sheet: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  secondaryButton: string;
  secondaryButtonPressed: string;
  like: string;
  success: string;
  warning: string;
  danger: string;
  link: string;
  skeleton: string;
  skeletonHighlight: string;
  overlay: string;
  simulation: string;
  simulationSoft: string;
  chart: string;
  /** Instagram Insights magenta line */
  chartLine: string;
  /** Lighter magenta used for the non-follower share of a bar */
  chartLineSoft: string;
  chartSecondary: string;
  chartGrid: string;
  storyRing: readonly [string, string, string];
  tabBar: string;
}

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAFA',
  sheet: '#FFFFFF',
  text: '#000000',
  textSecondary: '#737373',
  textTertiary: '#A8A8A8',
  border: '#EFEFEF',
  borderStrong: '#DBDBDB',
  primary: '#0095F6',
  primaryPressed: '#1877F2',
  onPrimary: '#FFFFFF',
  secondaryButton: '#EFEFEF',
  secondaryButtonPressed: '#DBDBDB',
  like: '#FF3040',
  success: '#1FA855',
  warning: '#F2A93B',
  danger: '#ED4956',
  link: '#00376B',
  skeleton: '#EFEFEF',
  skeletonHighlight: '#F7F7F7',
  overlay: 'rgba(0,0,0,0.5)',
  simulation: '#7C3AED',
  simulationSoft: 'rgba(124,58,237,0.10)',
  chart: '#0095F6',
  chartLine: '#D6338F',
  chartLineSoft: '#F0A2D4',
  chartSecondary: '#C7C7C7',
  chartGrid: '#EFEFEF',
  storyRing: ['#F9CE34', '#EE2A7B', '#6228D7'],
  tabBar: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  background: '#000000',
  surface: '#000000',
  surfaceElevated: '#121212',
  sheet: '#262626',
  text: '#F5F5F5',
  textSecondary: '#A8A8A8',
  textTertiary: '#737373',
  border: '#262626',
  borderStrong: '#363636',
  primary: '#0095F6',
  primaryPressed: '#1877F2',
  onPrimary: '#FFFFFF',
  secondaryButton: '#363636',
  secondaryButtonPressed: '#4A4A4A',
  like: '#FF3040',
  success: '#2ECC71',
  warning: '#F5B041',
  danger: '#ED4956',
  link: '#E0F1FF',
  skeleton: '#1C1C1C',
  skeletonHighlight: '#2A2A2A',
  overlay: 'rgba(0,0,0,0.6)',
  simulation: '#A78BFA',
  simulationSoft: 'rgba(167,139,250,0.16)',
  chart: '#0095F6',
  chartLine: '#D93E9C',
  chartLineSoft: '#E9A0D0',
  chartSecondary: '#4A4A4A',
  chartGrid: '#1F1F1F',
  storyRing: ['#F9CE34', '#EE2A7B', '#6228D7'],
  tabBar: '#000000',
};

export const themes: Record<ThemeMode, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

export const touch = {
  minTarget: 44,
  tabBarHeight: 50,
  headerHeight: 44,
  /** Long-press that opens a scenario editor — long enough that a tap or a scroll never triggers it. */
  longPressMs: 650,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
