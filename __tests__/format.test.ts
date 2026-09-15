import { formatCompact, formatNumber, formatPercent, parseNumericInput, percentChange } from '@/utils/format';

describe('formatCompact', () => {
  it('formats thousands and millions like Instagram (en)', () => {
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(12500)).toBe('12.5K');
    expect(formatCompact(12483)).toBe('12.4K');
    expect(formatCompact(124820)).toBe('124K');
    expect(formatCompact(1250000)).toBe('1.25M');
    expect(formatCompact(1478200)).toBe('1.47M');
    expect(formatCompact(0)).toBe('0');
  });

  it('uses Turkish suffixes and separators (tr)', () => {
    expect(formatCompact(11369, 'tr')).toBe('11,3 B');
    expect(formatCompact(1250000, 'tr')).toBe('1,25 Mn');
  });
});

describe('formatNumber', () => {
  it('groups digits per locale', () => {
    expect(formatNumber(12483)).toBe('12,483');
    expect(formatNumber(12483, 'tr')).toBe('12.483');
    expect(formatNumber(-1500)).toBe('-1,500');
  });
});

describe('formatPercent / percentChange', () => {
  it('adds sign and locale symbol placement', () => {
    expect(formatPercent(18.4)).toBe('+18.4%');
    expect(formatPercent(-5.25, 'tr')).toBe('-%5,3');
    expect(formatPercent(0)).toBe('0.0%');
  });
  it('computes change and handles missing previous', () => {
    expect(percentChange(120, 100)).toBeCloseTo(20);
    expect(percentChange(120, 0)).toBeNull();
    expect(percentChange(120, undefined)).toBeNull();
  });
});

describe('parseNumericInput', () => {
  it('parses grouped and compact input', () => {
    expect(parseNumericInput('12,500')).toBe(12500);
    expect(parseNumericInput('12.500')).toBe(12500);
    expect(parseNumericInput('12500')).toBe(12500);
    expect(parseNumericInput('12.5K')).toBe(12500);
    expect(parseNumericInput('1,25 Mn')).toBe(1250000);
    expect(parseNumericInput('50 000')).toBe(50000);
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput('')).toBeNull();
  });
});
