import { applyBoost, boostPercentFor, boostsEqual, combine, countBoosts, effectiveDial, latentGrowth, normalizeBoosts } from '@/services/simulation/boost';
import { resolveMetric } from '@/services/simulation/resolve';
import { useSimulationStore } from '@/store/simulationStore';
import type { SimulationScope } from '@/types/simulation';

const ACCOUNT: SimulationScope = { kind: 'account' };
const POST: SimulationScope = { kind: 'media', mediaId: 'm1' };
const KEY = 'demo:test';

describe('dial → metric (direct targets)', () => {
  const boosts = { followers: 50, plays: 100, views: 20, likes: 200, comments: 40 };

  it('followers dial drives follower count, new followers and follows from posts 1:1', () => {
    expect(boostPercentFor(boosts, ACCOUNT, 'followers')).toBe(50);
    expect(boostPercentFor(boosts, ACCOUNT, 'new_followers')).toBe(50);
    expect(boostPercentFor(boosts, POST, 'follows_from_post')).toBe(50);
  });

  it('plays dial drives per-post views / replays, reach at 85%, profile visits at 60%', () => {
    expect(boostPercentFor(boosts, POST, 'views')).toBe(100);
    expect(boostPercentFor(boosts, POST, 'replays')).toBe(100);
    expect(boostPercentFor(boosts, POST, 'reach')).toBeCloseTo(85);
    expect(boostPercentFor(boosts, POST, 'profile_visits')).toBeCloseTo(60);
  });

  it('views dial drives account views and account reach; likes / comments their own counts', () => {
    expect(boostPercentFor(boosts, ACCOUNT, 'views')).toBe(20);
    expect(boostPercentFor(boosts, ACCOUNT, 'reach')).toBeCloseTo(17);
    expect(boostPercentFor(boosts, POST, 'likes')).toBe(200);
    expect(boostPercentFor(boosts, POST, 'comments')).toBe(40);
  });
});

describe('coupling — raising one dial lifts everything else in proportion', () => {
  it('likes +100% implies ~80% more attention; the rest follow through their elasticities', () => {
    const boosts = { likes: 100 };
    expect(latentGrowth(boosts)).toBe(80);
    expect(boostPercentFor(boosts, POST, 'likes')).toBe(100); // the dial itself
    expect(boostPercentFor(boosts, POST, 'views')).toBeCloseTo(80); // 80 × 1
    expect(boostPercentFor(boosts, POST, 'comments')).toBeCloseTo(72); // 80 × 0.9
    expect(boostPercentFor(boosts, POST, 'shares')).toBeCloseTo(84); // 80 × 1.05
    expect(boostPercentFor(boosts, POST, 'saves')).toBeCloseTo(92); // 80 × 1.15
    expect(boostPercentFor(boosts, POST, 'reach')).toBeCloseTo(68); // 80 × 0.85
    expect(boostPercentFor(boosts, POST, 'profile_visits')).toBeCloseTo(48); // 80 × 0.6
    expect(boostPercentFor(boosts, ACCOUNT, 'views')).toBeCloseTo(80);
    expect(boostPercentFor(boosts, ACCOUNT, 'followers')).toBeCloseTo(24); // 80 × 0.3
    expect(boostPercentFor(boosts, ACCOUNT, 'new_followers')).toBeCloseTo(104); // 80 × 1.3
  });

  it('interactions follow the parts weighted by their share of the total (likes dominate)', () => {
    const boosts = { likes: 100 };
    const weighted = 100 * 0.78 + 72 * 0.07 + 84 * 0.06 + 92 * 0.09;
    expect(boostPercentFor(boosts, POST, 'interactions')).toBeCloseTo(weighted);
    expect(boostPercentFor(boosts, ACCOUNT, 'interactions')).toBeCloseTo(weighted);
    expect(boostPercentFor(boosts, ACCOUNT, 'accounts_engaged')).toBeCloseTo(weighted * 0.9);
  });

  it('a views / plays dial is the attention signal itself; followers is a weaker one', () => {
    expect(boostPercentFor({ views: 20 }, POST, 'views')).toBeCloseTo(20);
    expect(boostPercentFor({ plays: 20 }, ACCOUNT, 'views')).toBeCloseTo(20);
    expect(boostPercentFor({ followers: 100 }, POST, 'likes')).toBeCloseTo(60);
  });

  it('several dials merge: the strongest leads, the others add a quarter — never a plain sum', () => {
    expect(combine([80, 35])).toBeCloseTo(88.75);
    expect(combine([-20, 10])).toBeCloseTo(-17.5);
    expect(combine([])).toBe(0);
    const boosts = { likes: 100, comments: 50 }; // signals 80 and 35
    expect(latentGrowth(boosts)).toBeCloseTo(88.75);
    expect(boostPercentFor(boosts, POST, 'saves')).toBeCloseTo(88.75 * 1.15);
  });

  it('the scenario growth rate joins the dials as one more signal', () => {
    expect(latentGrowth({ likes: 10 }, 50)).toBeCloseTo(50 + 8 * 0.25);
    expect(latentGrowth({}, 50)).toBeUndefined(); // no dial → plain growth path
  });

  it('counts that cannot grow, and empty maps, stay untouched', () => {
    expect(boostPercentFor({ likes: 100 }, ACCOUNT, 'following')).toBeUndefined();
    expect(boostPercentFor({ likes: 100 }, ACCOUNT, 'media_count')).toBeUndefined();
    expect(boostPercentFor({}, POST, 'likes')).toBeUndefined();
    expect(boostPercentFor(undefined, POST, 'likes')).toBeUndefined();
    expect(boostPercentFor({ likes: 0 }, POST, 'likes')).toBeUndefined();
  });

  it('effectiveDial reports what each dial does right now', () => {
    expect(effectiveDial({ likes: 100 }, 'likes')).toEqual({ percent: 100, source: 'set' });
    expect(effectiveDial({ likes: 100 }, 'comments')).toEqual({ percent: 72, source: 'induced' });
    expect(effectiveDial({ likes: 100 }, 'followers')).toEqual({ percent: 24, source: 'induced' });
    expect(effectiveDial({}, 'followers', 50)).toEqual({ percent: 15, source: 'growth' });
    expect(effectiveDial({}, 'likes')).toEqual({ percent: 0, source: 'none' });
  });
});

describe('applyBoost / normalizeBoosts', () => {
  it('applies the percentage 1:1 without a seed; watch time keeps one decimal', () => {
    expect(applyBoost(1000, 50)).toBe(1500);
    expect(applyBoost(1000, -25)).toBe(750);
    expect(applyBoost(1000, 0)).toBe(1000);
    expect(applyBoost(12.4, 12, undefined, 'avg_watch_time')).toBeCloseTo(13.9);
  });

  it('adds a small deterministic deviation per post', () => {
    const a = applyBoost(1000, 100, 'm1:likes');
    const b = applyBoost(1000, 100, 'm2:likes');
    expect(a).toBe(applyBoost(1000, 100, 'm1:likes'));
    expect(Math.abs(a - 2000)).toBeLessThanOrEqual(80);
    expect(Math.abs(b - 2000)).toBeLessThanOrEqual(80);
  });

  it('drops zero dials, clamps the rest and compares maps', () => {
    expect(normalizeBoosts({ likes: 0, comments: 5000, views: Number.NaN, plays: -20 })).toEqual({ comments: 1000, plays: -20 });
    expect(countBoosts({ likes: 10, comments: 0 })).toBe(1);
    expect(boostsEqual({ likes: 10 }, { likes: 10, comments: 0 })).toBe(true);
    expect(boostsEqual({ likes: 10 }, { likes: 20 })).toBe(false);
  });
});

describe('resolveMetric precedence: override > boost > growth > real', () => {
  it('boost replaces the growth rate for its metric', () => {
    const resolved = resolveMetric(1000, undefined, true, { percent: 50, metric: 'likes', boostPercent: 200 });
    expect(resolved.displayValue).toBe(3000);
    expect(resolved.isSimulated).toBe(true);
  });

  it('falls back to growth when there is no boost, and to the override when there is one', () => {
    expect(resolveMetric(1000, undefined, true, { percent: 50, metric: 'likes' }).displayValue).toBe(1500);
    expect(resolveMetric(1000, 42, true, { percent: 50, metric: 'likes', boostPercent: 200 }).displayValue).toBe(42);
    expect(resolveMetric(1000, undefined, false, { percent: 50, metric: 'likes', boostPercent: 200 }).displayValue).toBe(1000);
  });
});

describe('simulation store boosts', () => {
  beforeEach(() => {
    useSimulationStore.setState({ accounts: {}, enabled: true });
  });

  it('sets, replaces, clears and resets boosts on the active scenario', () => {
    const store = useSimulationStore.getState();
    store.setBoost(KEY, 'likes', 150);
    store.setBoost(KEY, 'comments', 60);
    let boosts = useSimulationStore.getState().accounts[KEY]?.profiles[0]?.boosts;
    expect(boosts).toEqual({ likes: 150, comments: 60 });

    store.setBoost(KEY, 'comments', 0);
    boosts = useSimulationStore.getState().accounts[KEY]?.profiles[0]?.boosts;
    expect(boosts).toEqual({ likes: 150 });

    store.setBoosts(KEY, { followers: 25, plays: 300 });
    boosts = useSimulationStore.getState().accounts[KEY]?.profiles[0]?.boosts;
    expect(boosts).toEqual({ followers: 25, plays: 300 });

    store.resetAll(KEY);
    boosts = useSimulationStore.getState().accounts[KEY]?.profiles[0]?.boosts;
    expect(boosts).toEqual({});
  });

  it('duplicating a scenario copies its boosts and growth rate', () => {
    const store = useSimulationStore.getState();
    store.setBoosts(KEY, { likes: 100 });
    store.setGrowthPercent(KEY, 30);
    const sourceId = useSimulationStore.getState().accounts[KEY]?.activeProfileId as string;
    const copyId = store.duplicateProfile(KEY, sourceId);
    const copy = useSimulationStore.getState().accounts[KEY]?.profiles.find((p) => p.id === copyId);
    expect(copy?.boosts).toEqual({ likes: 100 });
    expect(copy?.growthPercent).toBe(30);
  });
});
