import { resolveMetric } from '@/services/simulation/resolve';
import { selectActiveProfile, useSimulationStore } from '@/store/simulationStore';
import { overrideKey } from '@/types/simulation';

const ACCOUNT = 'demo:zmtprefabrik';
const scope = { kind: 'account' } as const;

function display(real: number, metric: 'views' | 'followers' = 'views'): number {
  const state = useSimulationStore.getState();
  return resolveMetric(real, state.getOverride(ACCOUNT, scope, metric), state.enabled).displayValue;
}

describe('simulationStore', () => {
  beforeEach(() => {
    useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined });
  });

  it('real 1000 / simulation 5000: off → 1000, on → 5000, reset → 1000', () => {
    const store = useSimulationStore.getState();
    store.setOverride(ACCOUNT, scope, 'views', 5000);

    expect(display(1000)).toBe(1000); // simulationMode false
    store.setEnabled(true);
    expect(display(1000)).toBe(5000); // simulationMode true
    store.resetAll(ACCOUNT);
    expect(display(1000)).toBe(1000); // reset
  });

  it('never mutates the real value passed in', () => {
    const store = useSimulationStore.getState();
    store.setEnabled(true);
    store.setOverride(ACCOUNT, scope, 'views', 50_000);
    const resolved = resolveMetric(12_483, store.getOverride(ACCOUNT, scope, 'views'), true);
    expect(resolved.realValue).toBe(12_483);
    expect(resolved.displayValue).toBe(50_000);
    expect(resolved.isSimulated).toBe(true);
  });

  it('namespaces overrides per account', () => {
    const store = useSimulationStore.getState();
    store.setEnabled(true);
    store.setOverride(ACCOUNT, scope, 'followers', 15_000);
    expect(store.getOverride('public:natgeo', scope, 'followers')).toBeUndefined();
    expect(display(1248, 'followers')).toBe(15_000);
  });

  it('keeps scenarios isolated and switches the active one', () => {
    const store = useSimulationStore.getState();
    store.setEnabled(true);
    store.setOverride(ACCOUNT, scope, 'views', 5000);
    const defaultId = selectActiveProfile(useSimulationStore.getState(), ACCOUNT).id;
    const secondId = store.createProfile(ACCOUNT, 'Aggressive');
    expect(display(1000)).toBe(1000); // new scenario has no overrides
    store.setOverride(ACCOUNT, scope, 'views', 9000);
    expect(display(1000)).toBe(9000);
    store.setActiveProfile(ACCOUNT, defaultId);
    expect(display(1000)).toBe(5000);
    store.deleteProfile(ACCOUNT, secondId);
    expect(selectActiveProfile(useSimulationStore.getState(), ACCOUNT).id).toBe(defaultId);
  });

  it('applies growth factors to many keys at once and clears single overrides', () => {
    const store = useSimulationStore.getState();
    store.setEnabled(true);
    store.applyFactorToKeys(
      ACCOUNT,
      [
        { key: overrideKey(scope, 'views'), realValue: 1000 },
        { key: overrideKey(scope, 'followers'), realValue: 200 },
      ],
      2,
    );
    expect(display(1000)).toBe(2000);
    expect(display(200, 'followers')).toBe(400);
    store.clearOverride(ACCOUNT, scope, 'views');
    expect(display(1000)).toBe(1000);
    expect(display(200, 'followers')).toBe(400);
  });

  it('removes post overrides together with a simulated post', () => {
    const store = useSimulationStore.getState();
    store.addSimulatedMedia(ACCOUNT, { id: 'sim_1', type: 'IMAGE', localUri: 'file://x', caption: '', timestamp: new Date().toISOString(), likeCount: 1, commentCount: 0 });
    store.setOverride(ACCOUNT, { kind: 'media', mediaId: 'sim_1' }, 'likes', 500);
    store.removeSimulatedMedia(ACCOUNT, 'sim_1');
    const state = useSimulationStore.getState();
    expect(state.accounts[ACCOUNT]?.simulatedMedia).toHaveLength(0);
    expect(state.getOverride(ACCOUNT, { kind: 'media', mediaId: 'sim_1' }, 'likes')).toBeUndefined();
  });
});
