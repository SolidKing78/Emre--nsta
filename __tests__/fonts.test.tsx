import React from 'react';
import { StyleSheet, Text as RNText, type TextStyle } from 'react-native';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

import { Text } from '@/components/common/Text';
import { fontFamilyForWeight, fontStyles, fonts, normalizeWeight } from '@/constants/fonts';
import { letterSpacingFor, typography } from '@/constants/theme';

/**
 * The typeface only holds together if every weight lands on a real Inter cut: Android
 * ignores `fontWeight` once a family is set, so a weight that never became a family name
 * would silently render Regular.
 */

describe('weight → Inter cut', () => {
  it('snaps every way of writing a weight onto one of the four cuts', () => {
    expect(fontFamilyForWeight('400')).toBe(fonts.regular);
    expect(fontFamilyForWeight('normal')).toBe(fonts.regular);
    expect(fontFamilyForWeight(undefined)).toBe(fonts.regular);
    expect(fontFamilyForWeight(500)).toBe(fonts.medium);
    expect(fontFamilyForWeight('600')).toBe(fonts.semibold);
    expect(fontFamilyForWeight('semibold')).toBe(fonts.semibold);
    expect(fontFamilyForWeight('700')).toBe(fonts.bold);
    expect(fontFamilyForWeight('bold')).toBe(fonts.bold);
    expect(fontFamilyForWeight('900')).toBe(fonts.bold);
    // No light cut ships, so anything under 500 reads Regular.
    expect(fontFamilyForWeight('300')).toBe(fonts.regular);
    expect(fontFamilyForWeight('100')).toBe(fonts.regular);
  });

  it('never leaves the family and the weight disagreeing', () => {
    for (const style of Object.values(fontStyles)) {
      expect(fontFamilyForWeight(style.fontWeight)).toBe(style.fontFamily);
      expect(normalizeWeight(style.fontWeight)).toBe(style.fontWeight);
    }
  });

  it('gives every text variant a family', () => {
    for (const [name, variant] of Object.entries(typography)) {
      expect(Object.values(fonts)).toContain(variant.fontFamily);
      expect(fontFamilyForWeight(variant.fontWeight)).toBe(variant.fontFamily);
      expect(`${name}:${variant.letterSpacing}`).toBe(`${name}:${letterSpacingFor(variant.fontSize)}`);
    }
  });
});

function styleOf(node: React.ReactElement): TextStyle {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(node);
  });
  const rendered = tree.root.findByType(RNText);
  const flat = StyleSheet.flatten(rendered.props.style) as TextStyle;
  act(() => tree.unmount());
  return flat;
}

describe('<Text> resolves the cut', () => {
  it('takes the weight from the variant', () => {
    expect(styleOf(<Text variant="display">x</Text>)).toMatchObject({ fontFamily: fonts.bold, fontWeight: '700' });
    expect(styleOf(<Text variant="body">x</Text>)).toMatchObject({ fontFamily: fonts.regular, fontWeight: '400' });
    expect(styleOf(<Text variant="captionStrong">x</Text>)).toMatchObject({ fontFamily: fonts.semibold, fontWeight: '600' });
  });

  it('lets the weight prop win over the variant', () => {
    expect(styleOf(<Text variant="body" weight="700">x</Text>)).toMatchObject({ fontFamily: fonts.bold, fontWeight: '700' });
    expect(styleOf(<Text variant="display" weight="400">x</Text>)).toMatchObject({ fontFamily: fonts.regular, fontWeight: '400' });
  });

  it("picks up a caller's inline fontWeight — the case Android would otherwise render Regular", () => {
    expect(styleOf(<Text variant="small" style={{ fontWeight: '700' }}>x</Text>)).toMatchObject({ fontFamily: fonts.bold, fontWeight: '700' });
    expect(styleOf(<Text variant="body" style={{ fontWeight: '600' }}>x</Text>)).toMatchObject({ fontFamily: fonts.semibold, fontWeight: '600' });
    // An unsupported weight still lands on a real cut instead of a missing family.
    expect(styleOf(<Text variant="heading" style={{ fontWeight: '300', fontSize: 28 }}>x</Text>)).toMatchObject({ fontFamily: fonts.regular, fontWeight: '400' });
  });

  it('leaves a family the caller named alone', () => {
    expect(styleOf(<Text style={{ fontFamily: 'monospace' }}>x</Text>).fontFamily).toBe('monospace');
  });

  it('tracks an ad-hoc font size the way the scale would', () => {
    expect(styleOf(<Text variant="caption" style={{ fontSize: 40 }}>x</Text>).letterSpacing).toBe(letterSpacingFor(40));
    expect(styleOf(<Text variant="display" style={{ fontSize: 12 }}>x</Text>).letterSpacing).toBe(letterSpacingFor(12));
    // An explicit letterSpacing still wins (the wordmark, the badges).
    expect(styleOf(<Text variant="caption" style={{ letterSpacing: 1 }}>x</Text>).letterSpacing).toBe(1);
  });
});

/**
 * Sizes measured off the screen recording of Instagram: each string was cut out of a
 * frame, rendered in Inter at 100px, and the point size derived from the ratio of the two
 * ink heights (÷ 1.466, the recording's pixels per point). Locked in here so a later
 * "let's make it bigger" does not quietly walk away from Instagram again.
 */
describe('type scale matches the measured Instagram screen', () => {
  it('keeps tracking neutral', () => {
    for (const variant of Object.values(typography)) expect(variant.letterSpacing).toBe(0);
    expect(letterSpacingFor(11)).toBe(0);
    expect(letterSpacingFor(40)).toBe(0);
  });

  it('holds the sizes the measurements landed on', () => {
    // Section headings: "Görüntülemelerini etkileyen faktörler" 16.3pt · "Reklam" 16.4pt.
    expect(typography.heading.fontSize).toBe(18);
    // Bar labels "Reels sekmesi" 15.1pt and tab labels "Genel Bakış" 14.5pt → body.
    expect(typography.body.fontSize).toBe(15);
    // Card labels 12.4pt and the factor trend line 12.2pt → caption.
    expect(typography.caption.fontSize).toBe(13);
  });

  it('keeps line heights readable at every size', () => {
    for (const [name, variant] of Object.entries(typography)) {
      const ratio = variant.lineHeight / variant.fontSize;
      expect(`${name}:${ratio > 1.2 && ratio < 1.45}`).toBe(`${name}:true`);
    }
  });
});
