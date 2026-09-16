import AsyncStorage from '@react-native-async-storage/async-storage';

import { durableStorage } from '@/store/persistence';
import { migratePersisted, sanitizePersisted, SIMULATION_STORAGE_VERSION, useSimulationStore } from '@/store/simulationStore';
import { DEFAULT_AUDIENCE_MIX } from '@/types/simulation';

const KEY = 'sociallens.simulation.v1';
const ACCOUNT = 'demo:persist';

const flush = () => new Promise((r) => setTimeout(r, 30));

/**
 * Simulates a fresh launch: forget the in-memory state, put the given bytes on "disk"
 * (setState itself persists, so the disk is restored afterwards) and rehydrate.
 */
async function relaunch(primary: string | null, backup: string | null = primary): Promise<void> {
  useSimulationStore.setState({ accounts: {}, enabled: false, hydrated: false });
  await flush();
  if (primary === null) await AsyncStorage.removeItem(KEY);
  else await AsyncStorage.setItem(KEY, primary);
  if (backup === null) await AsyncStorage.removeItem(`${KEY}.bak`);
  else await AsyncStorage.setItem(`${KEY}.bak`, backup);
  await useSimulationStore.persist.rehydrate();
  await flush();
}

describe('durableStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('writes a last-known-good copy next to every value and reads it back', async () => {
    await durableStorage.setItem('k', '{"a":1}');
    expect(await AsyncStorage.getItem('k')).toBe('{"a":1}');
    expect(await AsyncStorage.getItem('k.bak')).toBe('{"a":1}');
    expect(await durableStorage.getItem('k')).toBe('{"a":1}');
  });

  it('falls back to the backup when the primary value is corrupt, and repairs it', async () => {
    await durableStorage.setItem('k', '{"a":1}');
    await AsyncStorage.setItem('k', '{"a":1'); // cut short mid-write
    expect(await durableStorage.getItem('k')).toBe('{"a":1}');
    expect(await AsyncStorage.getItem('k')).toBe('{"a":1}');
  });

  it('drops a corrupt value with no backup instead of throwing', async () => {
    await AsyncStorage.setItem('k', 'not json');
    expect(await durableStorage.getItem('k')).toBeNull();
    expect(await AsyncStorage.getItem('k')).toBeNull();
  });

  it('never throws when the underlying storage fails', async () => {
    // The jest mock's methods are already jest.fn()s, so swap implementations by hand
    // (spyOn + mockRestore would wipe the mock's own implementation for later tests).
    const storage = AsyncStorage as unknown as { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> };
    const originalGet = storage.getItem;
    const originalSet = storage.setItem;
    storage.getItem = () => Promise.reject(new Error('disk'));
    storage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await durableStorage.getItem('k')).toBeNull();
      await expect(durableStorage.setItem('k', '{}')).resolves.toBeUndefined();
    } finally {
      storage.getItem = originalGet;
      storage.setItem = originalSet;
    }
  });
});

describe('sanitizePersisted / migratePersisted', () => {
  it('keeps a valid scenario intact (boosts, growth, overrides, posts, profile edits)', () => {
    const raw = {
      enabled: true,
      lastChangedAt: '2026-09-15T18:00:00.000Z',
      accounts: {
        [ACCOUNT]: {
          profiles: [{ id: 'p1', name: 'Yaz', createdAt: '2026-09-01T00:00:00.000Z', overrides: { 'account:followers': 20000, 'media:m1:likes': 500 }, growthPercent: 35, boosts: { likes: 100, comments: 0 } }],
          activeProfileId: 'p1',
          simulatedMedia: [{ id: 's1', type: 'REEL', localUri: 'file:///a.mp4', caption: 'x', timestamp: '2026-09-10T00:00:00.000Z', likeCount: 10, commentCount: 2, viewCount: 300 }],
          profileOverrides: { name: 'Yeni ad', isVerified: true },
        },
      },
    };
    const out = sanitizePersisted(raw);
    expect(out.enabled).toBe(true);
    const account = out.accounts[ACCOUNT];
    expect(account?.activeProfileId).toBe('p1');
    expect(account?.profiles[0]).toEqual({ id: 'p1', name: 'Yaz', createdAt: '2026-09-01T00:00:00.000Z', overrides: { 'account:followers': 20000, 'media:m1:likes': 500 }, growthPercent: 35, boosts: { likes: 100 } });
    expect(account?.simulatedMedia).toHaveLength(1);
    expect(account?.profileOverrides).toEqual({ name: 'Yeni ad', isVerified: true });
  });

  it('drops what does not fit and never throws', () => {
    expect(sanitizePersisted(null)).toEqual({ enabled: false, accounts: {}, lastChangedAt: undefined });
    expect(sanitizePersisted('garbage')).toEqual({ enabled: false, accounts: {}, lastChangedAt: undefined });
    const out = sanitizePersisted({
      enabled: 'yes',
      accounts: {
        broken: { profiles: 'nope' },
        partial: {
          profiles: [{ id: 'ok', overrides: { 'account:followers': -5, 'bad key': 3, 'media:m:likes': 'x' }, growthPercent: 99999, boosts: { likes: 'a', comments: 50 } }, { name: 'no id' }],
          activeProfileId: 'missing',
          simulatedMedia: [{ id: 's', localUri: '' }, { id: 's2', localUri: 'file:///b.jpg', type: 'WEIRD' }],
          profileOverrides: 7,
        },
      },
    });
    expect(out.enabled).toBe(false);
    expect(Object.keys(out.accounts)).toEqual(['partial']);
    const account = out.accounts.partial;
    expect(account?.profiles).toHaveLength(1);
    expect(account?.activeProfileId).toBe('ok');
    expect(account?.profiles[0]?.overrides).toEqual({});
    expect(account?.profiles[0]?.growthPercent).toBe(1000); // clamped
    expect(account?.profiles[0]?.boosts).toEqual({ comments: 50 });
    expect(account?.simulatedMedia).toEqual([expect.objectContaining({ id: 's2', type: 'IMAGE' })]);
    expect(account?.profileOverrides).toEqual({});
    // An account stored before the audience mix existed comes back on the defaults.
    expect(account?.audienceMix).toEqual(DEFAULT_AUDIENCE_MIX);
    expect(account?.mediaAudienceMix).toEqual({});
  });

  it('keeps a stored audience mix and drops unusable per-post entries', () => {
    const out = sanitizePersisted({
      enabled: true,
      accounts: {
        a: {
          profiles: [{ id: 'p' }],
          activeProfileId: 'p',
          audienceMix: { followerShare: 2.5, followerVariance: 1, womenShare: 12, genderVariance: 'x' },
          mediaAudienceMix: { m1: { womenShare: 18 }, m2: { followerShare: 'nope' }, m3: 'junk' },
        },
      },
    });
    const account = out.accounts.a;
    expect(account?.audienceMix).toEqual({ followerShare: 2.5, followerVariance: 1, womenShare: 12, genderVariance: DEFAULT_AUDIENCE_MIX.genderVariance });
    expect(account?.mediaAudienceMix).toEqual({ m1: { womenShare: 18 } });
  });

  it('keeps hand-set post percentages and drops keys that are not "<group>.<name>"', () => {
    const out = sanitizePersisted({
      enabled: true,
      accounts: {
        a: {
          profiles: [{ id: 'p' }],
          activeProfileId: 'p',
          mediaStats: {
            m1: { 'factor.likes': 2.4, 'source.reels': 82.1, 'not a key': 5, 'age.18-24': 'x', 'watch.end': 9 },
            m2: { nothing: 1 },
            m3: 'junk',
          },
        },
      },
    });
    expect(out.accounts.a?.mediaStats).toEqual({ m1: { 'factor.likes': 2.4, 'source.reels': 82.1, 'watch.end': 9 } });
  });

  it('keeps the account-level bars the same way', () => {
    const out = sanitizePersisted({
      enabled: true,
      accounts: {
        a: {
          profiles: [{ id: 'p' }],
          activeProfileId: 'p',
          accountStats: { 'age.18-24': 42, 'country.Türkiye': 91.3, oops: 5, 'city.İstanbul': 'x' },
        },
      },
    });
    expect(out.accounts.a?.accountStats).toEqual({ 'age.18-24': 42, 'country.Türkiye': 91.3 });
  });

  it('carries the audience mix and every pinned percentage through a relaunch', async () => {
    const store = useSimulationStore.getState();
    store.setEnabled(true);
    store.setAudienceMix(ACCOUNT, { followerShare: 2.5, womenShare: 12 });
    store.setMediaAudienceMix(ACCOUNT, 'm1', { womenShare: 33 });
    store.setMediaStat(ACCOUNT, 'm1', 'factor.likes', 9.5);
    store.setAccountStat(ACCOUNT, 'age.18-24', 42);
    await flush();

    const onDisk = await AsyncStorage.getItem(KEY);
    await relaunch(onDisk);

    const account = useSimulationStore.getState().accounts[ACCOUNT];
    expect(useSimulationStore.getState().enabled).toBe(true);
    expect(account?.audienceMix).toMatchObject({ followerShare: 2.5, womenShare: 12 });
    expect(account?.mediaAudienceMix).toEqual({ m1: { womenShare: 33 } });
    expect(account?.mediaStats).toEqual({ m1: { 'factor.likes': 9.5 } });
    expect(account?.accountStats).toEqual({ 'age.18-24': 42 });
  });

  it('migrates older versions through the same sanitizer', () => {
    const migrated = migratePersisted({ enabled: true, accounts: {} }, 0);
    expect(migrated).toEqual({ enabled: true, accounts: {}, lastChangedAt: undefined });
    expect(SIMULATION_STORAGE_VERSION).toBe(5);
  });
});

describe('simulation store persistence round trip', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSimulationStore.setState({ accounts: {}, enabled: false });
  });

  it('a scenario survives a restart: what was saved is what comes back', async () => {
    const store = useSimulationStore.getState();
    store.ensureAccount(ACCOUNT);
    store.setEnabled(true);
    store.setBoosts(ACCOUNT, { likes: 100, followers: 25 });
    store.setGrowthPercent(ACCOUNT, 20);
    store.setOverride(ACCOUNT, { kind: 'account' }, 'followers', 50_000);
    await flush();

    const raw = await AsyncStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw as string) as { version: number; state: unknown };
    expect(saved.version).toBe(SIMULATION_STORAGE_VERSION);

    await relaunch(raw);
    const state = useSimulationStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.enabled).toBe(true);
    const profile = state.accounts[ACCOUNT]?.profiles[0];
    expect(profile?.boosts).toEqual({ likes: 100, followers: 25 });
    expect(profile?.growthPercent).toBe(20);
    expect(profile?.overrides).toEqual({ 'account:followers': 50_000 });
  });

  it('a corrupt file still lets the app start, and the backup brings the scenario back', async () => {
    const store = useSimulationStore.getState();
    store.ensureAccount(ACCOUNT);
    store.setBoosts(ACCOUNT, { views: 40 });
    await flush();
    const good = await AsyncStorage.getItem(KEY);
    await relaunch('{"state":{"accounts":', good); // primary cut short mid-write, backup intact
    const state = useSimulationStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.accounts[ACCOUNT]?.profiles[0]?.boosts).toEqual({ views: 40 });
  });

  it('with no backup either, the app still starts clean and hydrated', async () => {
    await relaunch('garbage', null);
    const state = useSimulationStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.accounts).toEqual({});
  });
});
