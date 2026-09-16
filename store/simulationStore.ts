import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { normalizeMix } from '@/services/analytics/audienceMix';
import { normalizeBoosts } from '@/services/simulation/boost';
import { clampGrowth } from '@/services/simulation/growth';
import type { MetricKey } from '@/types/app';
import {
  DEFAULT_AUDIENCE_MIX,
  overrideKey,
  parseOverrideKey,
  type AudienceMix,
  type BoostKey,
  type BoostMap,
  type MediaAudienceMix,
  type MediaAudienceMixMap,
  type MediaStatMap,
  type MediaStatOverrides,
  type OverrideKey,
  type ProfileOverrides,
  type SimulatedMedia,
  type SimulationProfile,
  type SimulationScope,
} from '@/types/simulation';
import { uid } from '@/utils/random';

import { durableStorage, hydrationHandler, isFiniteNumber, isRecord, isString } from './persistence';

/**
 * Simulation overlay store.
 *
 * Everything in here is SCENARIO data. It is namespaced by account key so that
 * switching between demo / public / live accounts never leaks overrides.
 * Real API responses are never written here.
 */

interface AccountSimulation {
  profiles: SimulationProfile[];
  activeProfileId: string;
  simulatedMedia: SimulatedMedia[];
  profileOverrides: ProfileOverrides;
  /**
   * Follower / non-follower and women / men splits. Account-wide rather than per
   * scenario: it describes who the audience is, not how big a scenario makes it.
   */
  audienceMix: AudienceMix;
  /** Hand-set splits for single posts, by media id. */
  mediaAudienceMix: MediaAudienceMixMap;
  /** Hand-set percentages on the post insights screen, by media id then dotted key. */
  mediaStats: MediaStatMap;
  /** Hand-set percentages on the account insights screen (age / city / country bars). */
  accountStats: MediaStatOverrides;
}

interface SimulationState {
  enabled: boolean;
  accounts: Record<string, AccountSimulation>;
  hydrated: boolean;
  lastChangedAt?: string;

  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
  setHydrated: (value: boolean) => void;

  ensureAccount: (accountKey: string) => void;
  getOverride: (accountKey: string, scope: SimulationScope, metric: MetricKey) => number | undefined;
  setOverride: (accountKey: string, scope: SimulationScope, metric: MetricKey, value: number) => void;
  clearOverride: (accountKey: string, scope: SimulationScope, metric: MetricKey) => void;
  resetAll: (accountKey: string) => void;
  setGrowthPercent: (accountKey: string, percent: number) => void;
  /** Sets one "Etkileşimi artır" dial; 0 removes it. */
  setBoost: (accountKey: string, key: BoostKey, percent: number) => void;
  /** Replaces every dial at once (the editor's Apply). */
  setBoosts: (accountKey: string, boosts: BoostMap) => void;
  clearBoosts: (accountKey: string) => void;
  applyFactorToKeys: (accountKey: string, entries: { key: OverrideKey; realValue: number }[], factor: number) => void;

  createProfile: (accountKey: string, name: string) => string;
  renameProfile: (accountKey: string, profileId: string, name: string) => void;
  duplicateProfile: (accountKey: string, profileId: string) => string;
  deleteProfile: (accountKey: string, profileId: string) => void;
  setActiveProfile: (accountKey: string, profileId: string) => void;

  addSimulatedMedia: (accountKey: string, media: SimulatedMedia) => void;
  updateSimulatedMedia: (accountKey: string, mediaId: string, patch: Partial<SimulatedMedia>) => void;
  removeSimulatedMedia: (accountKey: string, mediaId: string) => void;

  setProfileOverrides: (accountKey: string, patch: ProfileOverrides) => void;
  clearProfileOverrides: (accountKey: string) => void;

  /** Account-wide audience splits; a patch merges into the current mix. */
  setAudienceMix: (accountKey: string, patch: Partial<AudienceMix>) => void;
  resetAudienceMix: (accountKey: string) => void;
  /** Hand-set splits for one post; leaving a value out keeps what the post already had. */
  setMediaAudienceMix: (accountKey: string, mediaId: string, patch: MediaAudienceMix) => void;
  clearMediaAudienceMix: (accountKey: string, mediaId: string) => void;

  /** One hand-set percentage on a post's insights (dotted key); `undefined` gives it back. */
  setMediaStat: (accountKey: string, mediaId: string, key: string, value: number | undefined) => void;
  clearMediaStats: (accountKey: string, mediaId: string) => void;
  /** The same, for the account insights screen's own bars. */
  setAccountStat: (accountKey: string, key: string, value: number | undefined) => void;
  clearAccountStats: (accountKey: string) => void;

  clearAccount: (accountKey: string) => void;
}

const DEFAULT_PROFILE_NAME = 'Default';

function createDefaultAccount(): AccountSimulation {
  const id = uid('sim');
  return {
    profiles: [{ id, name: DEFAULT_PROFILE_NAME, createdAt: new Date().toISOString(), overrides: {} }],
    activeProfileId: id,
    simulatedMedia: [],
    profileOverrides: {},
    audienceMix: { ...DEFAULT_AUDIENCE_MIX },
    mediaAudienceMix: {},
    mediaStats: {},
    accountStats: {},
  };
}

function getAccount(state: SimulationState, accountKey: string): AccountSimulation {
  return state.accounts[accountKey] ?? createDefaultAccount();
}

/* ------------------------------------------------------------------ */
/* Persisted shape validation                                           */
/* ------------------------------------------------------------------ */

/** Storage version; bump together with `migratePersisted` when the persisted shape changes. */
export const SIMULATION_STORAGE_VERSION = 5;

type PersistedSimulation = Pick<SimulationState, 'enabled' | 'accounts' | 'lastChangedAt'>;

function sanitizeOverrides(raw: unknown): Record<OverrideKey, number> {
  const out: Record<OverrideKey, number> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (parseOverrideKey(key) && isFiniteNumber(value) && value >= 0) out[key] = Math.round(value);
  }
  return out;
}

function sanitizeProfile(raw: unknown): SimulationProfile | null {
  if (!isRecord(raw) || !isString(raw.id) || !raw.id) return null;
  const growth = isFiniteNumber(raw.growthPercent) ? clampGrowth(raw.growthPercent) : undefined;
  return {
    id: raw.id,
    name: isString(raw.name) && raw.name.trim() ? raw.name : DEFAULT_PROFILE_NAME,
    createdAt: isString(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
    overrides: sanitizeOverrides(raw.overrides),
    ...(growth !== undefined && growth !== 0 ? { growthPercent: growth } : {}),
    boosts: normalizeBoosts(isRecord(raw.boosts) ? (raw.boosts as SimulationProfile['boosts']) : undefined),
  };
}

const MEDIA_TYPES: readonly SimulatedMedia['type'][] = ['IMAGE', 'VIDEO', 'REEL', 'CAROUSEL_ALBUM'];

function sanitizeSimulatedMedia(raw: unknown): SimulatedMedia[] {
  if (!Array.isArray(raw)) return [];
  const out: SimulatedMedia[] = [];
  for (const item of raw) {
    if (!isRecord(item) || !isString(item.id) || !isString(item.localUri) || !item.localUri) continue;
    const type = MEDIA_TYPES.includes(item.type as SimulatedMedia['type']) ? (item.type as SimulatedMedia['type']) : 'IMAGE';
    out.push({
      id: item.id,
      type,
      localUri: item.localUri,
      caption: isString(item.caption) ? item.caption : '',
      timestamp: isString(item.timestamp) ? item.timestamp : new Date().toISOString(),
      likeCount: isFiniteNumber(item.likeCount) ? Math.max(0, Math.round(item.likeCount)) : 0,
      commentCount: isFiniteNumber(item.commentCount) ? Math.max(0, Math.round(item.commentCount)) : 0,
      ...(isFiniteNumber(item.viewCount) ? { viewCount: Math.max(0, Math.round(item.viewCount)) } : {}),
    });
  }
  return out;
}

function sanitizeProfileOverrides(raw: unknown): ProfileOverrides {
  if (!isRecord(raw)) return {};
  const out: ProfileOverrides = {};
  if (isString(raw.name)) out.name = raw.name;
  if (isString(raw.biography)) out.biography = raw.biography;
  if (isString(raw.website)) out.website = raw.website;
  if (isString(raw.category)) out.category = raw.category;
  if (isString(raw.profilePictureUri)) out.profilePictureUri = raw.profilePictureUri;
  if (typeof raw.isVerified === 'boolean') out.isVerified = raw.isVerified;
  return out;
}

function sanitizeMediaAudienceMix(raw: unknown): MediaAudienceMixMap {
  const out: MediaAudienceMixMap = {};
  if (!isRecord(raw)) return out;
  for (const [mediaId, value] of Object.entries(raw)) {
    if (!mediaId || !isRecord(value)) continue;
    const entry: MediaAudienceMix = {};
    if (isFiniteNumber(value.followerShare)) entry.followerShare = Math.min(100, Math.max(0, value.followerShare));
    if (isFiniteNumber(value.womenShare)) entry.womenShare = Math.min(100, Math.max(0, value.womenShare));
    if (entry.followerShare !== undefined || entry.womenShare !== undefined) out[mediaId] = entry;
  }
  return out;
}

function sanitizeStatOverrides(raw: unknown): MediaStatOverrides {
  const out: MediaStatOverrides = {};
  if (!isRecord(raw)) return out;
  for (const [key, percent] of Object.entries(raw)) {
    // Keys are "<group>.<name>"; everything stored here is a percentage.
    if (!/^[a-z]+\.[^.]+$/i.test(key) || !isFiniteNumber(percent)) continue;
    out[key] = Math.min(1000, Math.max(0, percent));
  }
  return out;
}

function sanitizeMediaStats(raw: unknown): MediaStatMap {
  const out: MediaStatMap = {};
  if (!isRecord(raw)) return out;
  for (const [mediaId, value] of Object.entries(raw)) {
    if (!mediaId) continue;
    const entry = sanitizeStatOverrides(value);
    if (Object.keys(entry).length > 0) out[mediaId] = entry;
  }
  return out;
}

function sanitizeAccount(raw: unknown): AccountSimulation | null {
  if (!isRecord(raw)) return null;
  const profiles = (Array.isArray(raw.profiles) ? raw.profiles : []).map(sanitizeProfile).filter((p): p is SimulationProfile => p !== null);
  if (profiles.length === 0) return null;
  const first = profiles[0] as SimulationProfile;
  const activeProfileId = isString(raw.activeProfileId) && profiles.some((p) => p.id === raw.activeProfileId) ? raw.activeProfileId : first.id;
  return {
    profiles,
    activeProfileId,
    simulatedMedia: sanitizeSimulatedMedia(raw.simulatedMedia),
    profileOverrides: sanitizeProfileOverrides(raw.profileOverrides),
    audienceMix: normalizeMix(isRecord(raw.audienceMix) ? (raw.audienceMix as Partial<AudienceMix>) : undefined),
    mediaAudienceMix: sanitizeMediaAudienceMix(raw.mediaAudienceMix),
    mediaStats: sanitizeMediaStats(raw.mediaStats),
    accountStats: sanitizeStatOverrides(raw.accountStats),
  };
}

/**
 * Turns whatever came out of storage into a valid state slice. Anything that does not
 * fit is dropped (never thrown), so a damaged entry can cost at most that one account's
 * scenario — never the app.
 */
export function sanitizePersisted(raw: unknown): PersistedSimulation {
  const out: PersistedSimulation = { enabled: false, accounts: {}, lastChangedAt: undefined };
  try {
    if (!isRecord(raw)) return out;
    out.enabled = raw.enabled === true;
    out.lastChangedAt = isString(raw.lastChangedAt) ? raw.lastChangedAt : undefined;
    if (isRecord(raw.accounts)) {
      for (const [key, value] of Object.entries(raw.accounts)) {
        const account = sanitizeAccount(value);
        if (account) out.accounts[key] = account;
      }
    }
  } catch (error) {
    console.warn('[simulation] persisted state could not be read; starting clean', error);
    return { enabled: false, accounts: {}, lastChangedAt: undefined };
  }
  return out;
}

/** v0…v4 → v5: same fields; the sanitizer fills in what older builds did not have (boosts, growth, audience mix, post + account stats). */
export function migratePersisted(raw: unknown, _fromVersion: number): PersistedSimulation {
  return sanitizePersisted(raw);
}

function activeProfile(account: AccountSimulation): SimulationProfile {
  return account.profiles.find((p) => p.id === account.activeProfileId) ?? (account.profiles[0] as SimulationProfile);
}

function updateActiveProfile(
  account: AccountSimulation,
  updater: (profile: SimulationProfile) => SimulationProfile,
): AccountSimulation {
  const current = activeProfile(account);
  return {
    ...account,
    profiles: account.profiles.map((p) => (p.id === current.id ? updater(p) : p)),
  };
}

const hydration = hydrationHandler<SimulationState>();

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      enabled: false,
      accounts: {},
      hydrated: false,
      lastChangedAt: undefined,

      setEnabled: (enabled) => set({ enabled }),
      toggle: () => set((s) => ({ enabled: !s.enabled })),
      setHydrated: (hydrated) => set({ hydrated }),

      ensureAccount: (accountKey) => {
        if (get().accounts[accountKey]) return;
        set((s) => ({ accounts: { ...s.accounts, [accountKey]: createDefaultAccount() } }));
      },

      getOverride: (accountKey, scope, metric) => {
        const account = get().accounts[accountKey];
        if (!account) return undefined;
        return activeProfile(account).overrides[overrideKey(scope, metric)];
      },

      setOverride: (accountKey, scope, metric, value) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          const key = overrideKey(scope, metric);
          const safe = Math.max(0, Math.round(value));
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: updateActiveProfile(account, (p) => ({ ...p, overrides: { ...p.overrides, [key]: safe } })),
            },
          };
        }),

      clearOverride: (accountKey, scope, metric) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          const key = overrideKey(scope, metric);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: updateActiveProfile(account, (p) => {
                const next = { ...p.overrides };
                delete next[key];
                return { ...p, overrides: next };
              }),
            },
          };
        }),

      /**
       * "Tüm senaryoları sıfırla": the scenario's own edits *and* everything else the user
       * can pin — the audience mix, per-post splits and every hand-set percentage. A reset
       * that left half the screen simulated would be worse than no reset at all.
       */
      resetAll: (accountKey) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: {
                ...updateActiveProfile(account, (p) => ({ ...p, overrides: {}, growthPercent: 0, boosts: {} })),
                audienceMix: { ...DEFAULT_AUDIENCE_MIX },
                mediaAudienceMix: {},
                mediaStats: {},
                accountStats: {},
              },
            },
          };
        }),

      setGrowthPercent: (accountKey, percent) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: updateActiveProfile(account, (p) => ({ ...p, growthPercent: clampGrowth(percent) })),
            },
          };
        }),

      setBoost: (accountKey, key, percent) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: updateActiveProfile(account, (p) => ({ ...p, boosts: normalizeBoosts({ ...p.boosts, [key]: percent }) })),
            },
          };
        }),

      setBoosts: (accountKey, boosts) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: updateActiveProfile(account, (p) => ({ ...p, boosts: normalizeBoosts(boosts) })),
            },
          };
        }),

      clearBoosts: (accountKey) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: updateActiveProfile(account, (p) => ({ ...p, boosts: {} })),
            },
          };
        }),

      applyFactorToKeys: (accountKey, entries, factor) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: updateActiveProfile(account, (p) => {
                const overrides = { ...p.overrides };
                for (const entry of entries) {
                  overrides[entry.key] = Math.max(0, Math.round(entry.realValue * factor));
                }
                return { ...p, overrides };
              }),
            },
          };
        }),

      createProfile: (accountKey, name) => {
        const id = uid('sim');
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            accounts: {
              ...s.accounts,
              [accountKey]: {
                ...account,
                profiles: [...account.profiles, { id, name: name.trim() || DEFAULT_PROFILE_NAME, createdAt: new Date().toISOString(), overrides: {} }],
                activeProfileId: id,
              },
            },
          };
        });
        return id;
      },

      renameProfile: (accountKey, profileId, name) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            accounts: {
              ...s.accounts,
              [accountKey]: {
                ...account,
                profiles: account.profiles.map((p) => (p.id === profileId ? { ...p, name: name.trim() || p.name } : p)),
              },
            },
          };
        }),

      duplicateProfile: (accountKey, profileId) => {
        const id = uid('sim');
        set((s) => {
          const account = getAccount(s, accountKey);
          const source = account.profiles.find((p) => p.id === profileId);
          if (!source) return {};
          return {
            accounts: {
              ...s.accounts,
              [accountKey]: {
                ...account,
                profiles: [
                  ...account.profiles,
                  {
                    id,
                    name: `${source.name} (2)`,
                    createdAt: new Date().toISOString(),
                    overrides: { ...source.overrides },
                    growthPercent: source.growthPercent,
                    boosts: { ...source.boosts },
                  },
                ],
                activeProfileId: id,
              },
            },
          };
        });
        return id;
      },

      deleteProfile: (accountKey, profileId) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          if (account.profiles.length <= 1) return {};
          const profiles = account.profiles.filter((p) => p.id !== profileId);
          const first = profiles[0] as SimulationProfile;
          return {
            accounts: {
              ...s.accounts,
              [accountKey]: {
                ...account,
                profiles,
                activeProfileId: account.activeProfileId === profileId ? first.id : account.activeProfileId,
              },
            },
          };
        }),

      setActiveProfile: (accountKey, profileId) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          if (!account.profiles.some((p) => p.id === profileId)) return {};
          return { accounts: { ...s.accounts, [accountKey]: { ...account, activeProfileId: profileId } } };
        }),

      addSimulatedMedia: (accountKey, media) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: { ...account, simulatedMedia: [media, ...account.simulatedMedia] },
            },
          };
        }),

      updateSimulatedMedia: (accountKey, mediaId, patch) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            accounts: {
              ...s.accounts,
              [accountKey]: {
                ...account,
                simulatedMedia: account.simulatedMedia.map((m) => (m.id === mediaId ? { ...m, ...patch } : m)),
              },
            },
          };
        }),

      removeSimulatedMedia: (accountKey, mediaId) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          const prefix = `media:${mediaId}:`;
          const mediaAudienceMix = { ...account.mediaAudienceMix };
          delete mediaAudienceMix[mediaId];
          const mediaStats = { ...account.mediaStats };
          delete mediaStats[mediaId];
          return {
            accounts: {
              ...s.accounts,
              [accountKey]: {
                ...updateActiveProfile(account, (p) => {
                  const overrides = Object.fromEntries(Object.entries(p.overrides).filter(([k]) => !k.startsWith(prefix)));
                  return { ...p, overrides };
                }),
                simulatedMedia: account.simulatedMedia.filter((m) => m.id !== mediaId),
                mediaAudienceMix,
                mediaStats,
              },
            },
          };
        }),

      setProfileOverrides: (accountKey, patch) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: { ...account, profileOverrides: { ...account.profileOverrides, ...patch } },
            },
          };
        }),

      clearProfileOverrides: (accountKey) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return { accounts: { ...s.accounts, [accountKey]: { ...account, profileOverrides: {} } } };
        }),

      setAudienceMix: (accountKey, patch) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: { ...account, audienceMix: normalizeMix({ ...account.audienceMix, ...patch }) },
            },
          };
        }),

      resetAudienceMix: (accountKey) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: { ...account, audienceMix: { ...DEFAULT_AUDIENCE_MIX }, mediaAudienceMix: {} },
            },
          };
        }),

      setMediaAudienceMix: (accountKey, mediaId, patch) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          const next: MediaAudienceMix = { ...account.mediaAudienceMix[mediaId], ...patch };
          if (next.followerShare !== undefined) next.followerShare = Math.min(100, Math.max(0, next.followerShare));
          if (next.womenShare !== undefined) next.womenShare = Math.min(100, Math.max(0, next.womenShare));
          const mediaAudienceMix = { ...account.mediaAudienceMix };
          // An entry with nothing set is the same as no entry: the post follows the mix again.
          if (next.followerShare === undefined && next.womenShare === undefined) delete mediaAudienceMix[mediaId];
          else mediaAudienceMix[mediaId] = next;
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: { ...s.accounts, [accountKey]: { ...account, mediaAudienceMix } },
          };
        }),

      clearMediaAudienceMix: (accountKey, mediaId) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          const mediaAudienceMix = { ...account.mediaAudienceMix };
          delete mediaAudienceMix[mediaId];
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: { ...s.accounts, [accountKey]: { ...account, mediaAudienceMix } },
          };
        }),

      setMediaStat: (accountKey, mediaId, key, value) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          const entry = { ...account.mediaStats[mediaId] };
          if (value === undefined || !Number.isFinite(value)) delete entry[key];
          else entry[key] = Math.min(1000, Math.max(0, value));
          const mediaStats = { ...account.mediaStats };
          if (Object.keys(entry).length === 0) delete mediaStats[mediaId];
          else mediaStats[mediaId] = entry;
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: { ...s.accounts, [accountKey]: { ...account, mediaStats } },
          };
        }),

      clearMediaStats: (accountKey, mediaId) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          const mediaStats = { ...account.mediaStats };
          delete mediaStats[mediaId];
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: { ...s.accounts, [accountKey]: { ...account, mediaStats } },
          };
        }),

      setAccountStat: (accountKey, key, value) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          const accountStats = { ...account.accountStats };
          if (value === undefined || !Number.isFinite(value)) delete accountStats[key];
          else accountStats[key] = Math.min(1000, Math.max(0, value));
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: { ...s.accounts, [accountKey]: { ...account, accountStats } },
          };
        }),

      clearAccountStats: (accountKey) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: { ...s.accounts, [accountKey]: { ...account, accountStats: {} } },
          };
        }),

      clearAccount: (accountKey) =>
        set((s) => {
          const next = { ...s.accounts };
          delete next[accountKey];
          return { accounts: next };
        }),
    }),
    {
      name: 'sociallens.simulation.v1',
      version: SIMULATION_STORAGE_VERSION,
      storage: createJSONStorage(() => durableStorage),
      partialize: (state) => ({ enabled: state.enabled, accounts: state.accounts, lastChangedAt: state.lastChangedAt }),
      migrate: migratePersisted,
      // Validate on every load, not only on migrations: a bad entry costs one scenario, never a crash.
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
      onRehydrateStorage: hydration.onRehydrateStorage,
    },
  ),
);
hydration.attach(useSimulationStore);

/* ------------------------------------------------------------------ */
/* Selectors (pure, safe to use in components)                         */
/* ------------------------------------------------------------------ */

export function selectAccountSim(state: SimulationState, accountKey: string): AccountSimulation {
  return state.accounts[accountKey] ?? createDefaultAccount();
}

export function selectActiveProfile(state: SimulationState, accountKey: string): SimulationProfile {
  return activeProfile(selectAccountSim(state, accountKey));
}

export function selectOverrides(state: SimulationState, accountKey: string): Record<OverrideKey, number> {
  return selectActiveProfile(state, accountKey).overrides;
}

export function selectGrowthPercent(state: SimulationState, accountKey: string): number {
  const account = state.accounts[accountKey];
  if (!account) return 0;
  return selectActiveProfile(state, accountKey).growthPercent ?? 0;
}

export function selectBoosts(state: SimulationState, accountKey: string): BoostMap {
  const account = state.accounts[accountKey];
  if (!account) return EMPTY_BOOSTS;
  return selectActiveProfile(state, accountKey).boosts ?? EMPTY_BOOSTS;
}

export function selectAudienceMix(state: SimulationState, accountKey: string): AudienceMix {
  return state.accounts[accountKey]?.audienceMix ?? DEFAULT_AUDIENCE_MIX;
}

export function selectMediaAudienceMix(state: SimulationState, accountKey: string): MediaAudienceMixMap {
  return state.accounts[accountKey]?.mediaAudienceMix ?? EMPTY_MEDIA_AUDIENCE_MIX;
}

export function selectMediaStats(state: SimulationState, accountKey: string, mediaId: string): MediaStatOverrides {
  return state.accounts[accountKey]?.mediaStats?.[mediaId] ?? EMPTY_MEDIA_STATS;
}

export function selectAccountStats(state: SimulationState, accountKey: string): MediaStatOverrides {
  return state.accounts[accountKey]?.accountStats ?? EMPTY_MEDIA_STATS;
}

/** How many values the user pinned on a post: counts, its splits and its percentages. */
export function countPostEdits(state: SimulationState, accountKey: string, mediaId: string): number {
  const account = state.accounts[accountKey];
  if (!account) return 0;
  const counts = countOverrides(activeProfile(account).overrides, `media:${mediaId}:`);
  const splits = Object.keys(account.mediaAudienceMix[mediaId] ?? {}).length;
  const percentages = Object.keys(account.mediaStats[mediaId] ?? {}).length;
  return counts + splits + percentages;
}

export function countOverrides(overrides: Record<OverrideKey, number>, prefix?: string): number {
  return Object.keys(overrides).filter((k) => (prefix ? k.startsWith(prefix) : true)).length;
}

export const EMPTY_OVERRIDES: Record<OverrideKey, number> = Object.freeze({}) as Record<OverrideKey, number>;
export const EMPTY_BOOSTS: BoostMap = Object.freeze({}) as BoostMap;
export const EMPTY_SIMULATED_MEDIA: readonly SimulatedMedia[] = Object.freeze([]);
export const EMPTY_PROFILE_OVERRIDES: ProfileOverrides = Object.freeze({});
export const EMPTY_MEDIA_AUDIENCE_MIX: MediaAudienceMixMap = Object.freeze({}) as MediaAudienceMixMap;
export const EMPTY_MEDIA_STATS: MediaStatOverrides = Object.freeze({}) as MediaStatOverrides;
