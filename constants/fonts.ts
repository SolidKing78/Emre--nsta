import type { TextStyle } from 'react-native';

/**
 * App typeface.
 *
 * Instagram renders its whole UI in Instagram Sans — a neo-grotesque with the same
 * skeleton, x-height and tight apertures as Inter. Instagram Sans is not licensable,
 * so the app ships the four static Inter cuts, which read as the closest match, and
 * pairs them with Instagram's tracking (see `typography`).
 *
 * Android ignores `fontWeight` as soon as a custom family is set, so the weight has to
 * live in the family name. iOS resolves the family first and then applies the weight,
 * so the two must always agree — `fontStyleForWeight` returns the matching pair.
 */

export const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

export type FontFamilyName = (typeof fonts)[keyof typeof fonts];

/** Weights the app actually ships. Anything else is snapped onto the nearest cut. */
export type AppFontWeight = '400' | '500' | '600' | '700';

/** Passed to `useFonts` at startup; the keys match the fonts' PostScript names. */
export const fontAssets = {
  [fonts.regular]: require('../assets/fonts/Inter-Regular.ttf'),
  [fonts.medium]: require('../assets/fonts/Inter-Medium.ttf'),
  [fonts.semibold]: require('../assets/fonts/Inter-SemiBold.ttf'),
  [fonts.bold]: require('../assets/fonts/Inter-Bold.ttf'),
};

function weightNumber(weight: TextStyle['fontWeight'] | undefined): number {
  if (weight === undefined || weight === null) return 400;
  if (weight === 'normal') return 400;
  if (weight === 'bold') return 700;
  if (weight === 'ultralight' || weight === 'thin') return 100;
  if (weight === 'light') return 300;
  if (weight === 'medium') return 500;
  if (weight === 'semibold') return 600;
  if (weight === 'heavy' || weight === 'black') return 900;
  const n = typeof weight === 'number' ? weight : Number(weight);
  return Number.isFinite(n) ? n : 400;
}

/** Snaps any weight onto one of the four cuts the app ships. */
export function normalizeWeight(weight: TextStyle['fontWeight'] | undefined): AppFontWeight {
  const n = weightNumber(weight);
  if (n >= 700) return '700';
  if (n >= 600) return '600';
  if (n >= 500) return '500';
  return '400';
}

export function fontFamilyForWeight(weight: TextStyle['fontWeight'] | undefined): FontFamilyName {
  switch (normalizeWeight(weight)) {
    case '700':
      return fonts.bold;
    case '600':
      return fonts.semibold;
    case '500':
      return fonts.medium;
    default:
      return fonts.regular;
  }
}

/**
 * The family/weight pair for a weight. Always use both together: the family carries the
 * weight on Android, and the weight keeps iOS from resolving a different cut of the family.
 */
export function fontStyleForWeight(weight: TextStyle['fontWeight'] | undefined): { fontFamily: FontFamilyName; fontWeight: AppFontWeight } {
  const normalized = normalizeWeight(weight);
  return { fontFamily: fontFamilyForWeight(normalized), fontWeight: normalized };
}

/** Ready-made styles for the handful of places that style a raw RN `Text` / `TextInput`. */
export const fontStyles = {
  regular: fontStyleForWeight('400'),
  medium: fontStyleForWeight('500'),
  semibold: fontStyleForWeight('600'),
  bold: fontStyleForWeight('700'),
} as const;
