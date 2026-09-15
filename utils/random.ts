/** Deterministic helpers so demo / estimated data is stable between renders and restarts. */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG */
export function createRng(seed: number | string): () => number {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a daily series whose sum ≈ total, with weekly rhythm + mild trend + noise.
 */
export function buildSeries(
  dates: string[],
  total: number,
  seed: string,
  options: { trend?: number; noise?: number; weekend?: number } = {},
): { date: string; value: number }[] {
  const rng = createRng(seed);
  const trend = options.trend ?? 0.25;
  const noise = options.noise ?? 0.35;
  const weekend = options.weekend ?? 0.85;
  const n = Math.max(1, dates.length);
  const weights = dates.map((date, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const day = new Date(date).getDay();
    const w = (day === 0 || day === 6 ? weekend : 1) * (1 + trend * (t - 0.5)) * (1 + (rng() - 0.5) * noise);
    return Math.max(0.05, w);
  });
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return dates.map((date, i) => ({ date, value: Math.round((total * (weights[i] ?? 0)) / sum) }));
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick() on empty list');
  return item;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
