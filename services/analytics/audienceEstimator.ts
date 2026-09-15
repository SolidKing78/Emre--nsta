import type { AppAudience, AudienceBucket, MetricSource } from '@/types/app';
import { createRng } from '@/utils/random';

const AGE_LABELS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Kocaeli', 'Adana'];
const COUNTRIES = ['Türkiye', 'Almanya', 'Azerbaycan', 'Hollanda', 'Birleşik Krallık'];

function normalize(values: number[], total = 100): number[] {
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  const scaled = values.map((v) => Math.round((v / sum) * total * 10) / 10);
  const drift = Math.round((total - scaled.reduce((a, b) => a + b, 0)) * 10) / 10;
  scaled[0] = Math.round(((scaled[0] ?? 0) + drift) * 10) / 10;
  return scaled;
}

function buckets(labels: string[], weights: number[]): AudienceBucket[] {
  const values = normalize(weights);
  return labels.map((label, i) => ({ label, value: values[i] ?? 0 })).sort((a, b) => b.value - a.value);
}

/**
 * Deterministic audience profile for sources that cannot expose demographics
 * (public / manual). Seeded by the username so it is stable across restarts.
 */
export function estimateAudience(seed: string, source: MetricSource = 'estimated'): AppAudience {
  const rng = createRng(`audience-${seed}`);
  const women = Math.round((28 + rng() * 40) * 10) / 10;
  const ageWeights = [1 + rng() * 2, 12 + rng() * 14, 26 + rng() * 16, 18 + rng() * 12, 8 + rng() * 8, 3 + rng() * 5, 1 + rng() * 3];
  const cityWeights = CITIES.map((_, i) => Math.max(1, 34 - i * 5 + (rng() - 0.5) * 8));
  const countryWeights = [78 + rng() * 14, 3 + rng() * 5, 2 + rng() * 3, 1 + rng() * 2, 1 + rng() * 2];
  const activeHours = Array.from({ length: 24 }, (_, h) => {
    const evening = Math.exp(-Math.pow((h - 20) / 3.2, 2));
    const noon = 0.55 * Math.exp(-Math.pow((h - 12.5) / 2.5, 2));
    const night = h < 6 ? 0.08 : 0.2;
    return Math.min(1, evening + noon + night + (rng() - 0.5) * 0.08);
  });
  return {
    followerShare: Math.round((0.3 + rng() * 0.35) * 1000) / 1000,
    gender: { women, men: Math.round((100 - women) * 10) / 10 },
    ages: buckets(AGE_LABELS, ageWeights),
    cities: buckets(CITIES, cityWeights).slice(0, 5),
    countries: buckets(COUNTRIES, countryWeights).slice(0, 5),
    activeHours,
    source,
  };
}

export const DEMO_AUDIENCE: AppAudience = {
  followerShare: 0.382,
  gender: { women: 31.8, men: 68.2 },
  ages: [
    { label: '25-34', value: 38.4 },
    { label: '35-44', value: 27.1 },
    { label: '18-24', value: 14.2 },
    { label: '45-54', value: 11.6 },
    { label: '55-64', value: 5.3 },
    { label: '65+', value: 2.1 },
    { label: '13-17', value: 1.3 },
  ],
  cities: [
    { label: 'İstanbul', value: 31.4 },
    { label: 'Ankara', value: 12.2 },
    { label: 'İzmir', value: 9.1 },
    { label: 'Bursa', value: 6.4 },
    { label: 'Antalya', value: 5.2 },
  ],
  countries: [
    { label: 'Türkiye', value: 91.3 },
    { label: 'Almanya', value: 3.6 },
    { label: 'Azerbaycan', value: 1.9 },
    { label: 'Hollanda', value: 1.2 },
    { label: 'Birleşik Krallık', value: 0.8 },
  ],
  activeHours: Array.from({ length: 24 }, (_, h) => {
    const evening = Math.exp(-Math.pow((h - 20) / 3.2, 2));
    const noon = 0.55 * Math.exp(-Math.pow((h - 12.5) / 2.5, 2));
    return Math.min(1, evening + noon + (h < 6 ? 0.06 : 0.2));
  }),
  source: 'mock',
};
