import { engagementFromMetrics, engagementRate, totalInteractions } from '@/services/analytics/engagement';
import type { AppMetric } from '@/types/app';

const base = { likes: 824, comments: 48, saves: 66, shares: 22, reach: 9200, followers: 11300 };

describe('engagementRate', () => {
  it('computes by reach', () => {
    expect(engagementRate(base, 'reach')).toBeCloseTo(((824 + 48 + 66 + 22) / 9200) * 100, 5);
  });
  it('computes by followers', () => {
    expect(engagementRate(base, 'followers')).toBeCloseTo(((824 + 48 + 66 + 22) / 11300) * 100, 5);
  });
  it('returns null without a denominator instead of dividing by zero', () => {
    expect(engagementRate({ ...base, reach: 0 }, 'reach')).toBeNull();
    expect(engagementRate({ ...base, followers: 0 }, 'followers')).toBeNull();
  });
});

describe('engagementFromMetrics / totalInteractions', () => {
  const metrics: AppMetric[] = [
    { key: 'likes', value: 100, source: 'api' },
    { key: 'comments', value: 10, source: 'api' },
    { key: 'saves', value: 5, source: 'api' },
    { key: 'shares', value: 5, source: 'api' },
    { key: 'reach', value: 1000, source: 'api' },
  ];
  it('derives rate from metric list', () => {
    expect(engagementFromMetrics(metrics, 5000, 'reach')).toBeCloseTo(12);
    expect(engagementFromMetrics(metrics, 5000, 'followers')).toBeCloseTo(2.4);
  });
  it('sums interactions when the source did not provide a total', () => {
    expect(totalInteractions(metrics)).toBe(120);
    expect(totalInteractions([...metrics, { key: 'interactions', value: 999, source: 'api' }])).toBe(999);
  });
});
