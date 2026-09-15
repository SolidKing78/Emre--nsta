import { applyGrowth, clampGrowth, growthFactor } from '@/services/simulation/growth';
import { resolveMetric } from '@/services/simulation/resolve';
import { selectGrowthPercent, useSimulationStore } from '@/store/simulationStore';

const ACCOUNT = 'demo:zmtprefabrik';

describe('growth model', () => {
  it('moves metrics with realistic elasticity', () => {
    expect(applyGrowth(1000, 'views', 50)).toBe(1500); // 1:1
    expect(applyGrowth(1000, 'reach', 50)).toBe(1425); // 0.85
    expect(applyGrowth(1000, 'saves', 100)).toBe(2150); // 1.15
    expect(applyGrowth(10_000, 'followers', 100)).toBe(13_000); // 0.3 — followers grow slowly
    expect(applyGrowth(15, 'following', 300)).toBe(15); // cannot grow
    expect(applyGrowth(284, 'media_count', 300)).toBe(284);
  });

  it('supports decline and clamps the rate', () => {
    expect(applyGrowth(1000, 'views', -50)).toBe(500);
    expect(clampGrowth(5000)).toBe(1000);
    expect(clampGrowth(-99)).toBe(-90);
    expect(clampGrowth(Number.NaN)).toBe(0);
    expect(applyGrowth(1000, 'views', 0)).toBe(1000);
  });

  it('adds a small deterministic deviation per post but none at account level', () => {
    const a = growthFactor('likes', 100, 'post-1:likes');
    const b = growthFactor('likes', 100, 'post-1:likes');
    const c = growthFactor('likes', 100, 'post-2:likes');
    expect(a).toBe(b); // deterministic
    expect(Math.abs(a - 2)).toBeLessThanOrEqual(0.08 + 1e-9); // within ±4% of the 2× factor
    expect(growthFactor('likes', 100)).toBe(2); // no seed → exact
    expect(a === c && Math.abs(a - 2) < 1e-9).toBe(false);
  });
});

describe('resolveMetric with growth', () => {
  it('applies growth only when simulation is on and no explicit override exists', () => {
    const growth = { percent: 50, metric: 'views' as const };
    expect(resolveMetric(1000, undefined, false, growth).displayValue).toBe(1000);
    expect(resolveMetric(1000, undefined, true, growth).displayValue).toBe(1500);
    expect(resolveMetric(1000, 7000, true, growth).displayValue).toBe(7000); // explicit edit wins
    expect(resolveMetric(1000, undefined, true, growth).isSimulated).toBe(true);
    expect(resolveMetric(1000, undefined, true, { percent: 0, metric: 'views' }).isSimulated).toBe(false);
  });
});

describe('simulationStore growth percent', () => {
  beforeEach(() => {
    useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined });
  });

  it('stores the rate per scenario and resetAll clears it', () => {
    const store = useSimulationStore.getState();
    store.setGrowthPercent(ACCOUNT, 35);
    expect(selectGrowthPercent(useSimulationStore.getState(), ACCOUNT)).toBe(35);
    store.createProfile(ACCOUNT, 'Second');
    expect(selectGrowthPercent(useSimulationStore.getState(), ACCOUNT)).toBe(0); // new scenario starts clean
    store.setGrowthPercent(ACCOUNT, 2500);
    expect(selectGrowthPercent(useSimulationStore.getState(), ACCOUNT)).toBe(1000); // clamped
    store.resetAll(ACCOUNT);
    expect(selectGrowthPercent(useSimulationStore.getState(), ACCOUNT)).toBe(0);
  });
});
