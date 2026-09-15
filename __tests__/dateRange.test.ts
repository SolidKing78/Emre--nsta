import { buildDateRange, daysBetween, eachDay, isWithinRange, previousRange, toISODate } from '@/utils/date';

describe('date ranges', () => {
  const now = new Date(2026, 8, 15); // 15 Sep 2026

  it('builds 7d / 30d / 90d ranges ending today', () => {
    expect(buildDateRange('7d', now)).toEqual({ preset: '7d', since: '2026-09-09', until: '2026-09-15' });
    expect(buildDateRange('30d', now)).toEqual({ preset: '30d', since: '2026-08-17', until: '2026-09-15' });
    expect(daysBetween(buildDateRange('90d', now).since, '2026-09-15')).toBe(90);
  });

  it('falls back to 30d when custom is requested without bounds', () => {
    expect(buildDateRange('custom', now).preset).toBe('30d');
    expect(buildDateRange('custom', now, { since: '2026-01-01', until: '2026-01-31' })).toEqual({ preset: 'custom', since: '2026-01-01', until: '2026-01-31' });
  });

  it('computes the previous equal-length period', () => {
    const prev = previousRange({ preset: '7d', since: '2026-09-09', until: '2026-09-15' });
    expect(prev.since).toBe('2026-09-02');
    expect(prev.until).toBe('2026-09-08');
  });

  it('enumerates days and checks membership', () => {
    const range = { preset: '7d' as const, since: '2026-09-09', until: '2026-09-15' };
    expect(eachDay(range)).toHaveLength(7);
    expect(eachDay(range)[0]).toBe('2026-09-09');
    expect(isWithinRange(new Date(2026, 8, 10, 12).toISOString(), range)).toBe(true);
    expect(isWithinRange(new Date(2026, 7, 1).toISOString(), range)).toBe(false);
  });

  it('formats ISO dates without timezone drift', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
