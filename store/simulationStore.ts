import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clampGrowth } from '@/services/simulation/growth';
import type { MetricKey } from '@/types/app';
import {
  overrideKey,
  type OverrideKey,
  type ProfileOverrides,
  type SimulatedMedia,
  type SimulationProfile,
  type SimulationScope,
} from '@/types/simulation';
import { uid } from '@/utils/random';

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
  };
}

function getAccount(state: SimulationState, accountKey: string): AccountSimulation {
  return state.accounts[accountKey] ?? createDefaultAccount();
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

      resetAll: (accountKey) =>
        set((s) => {
          const account = getAccount(s, accountKey);
          return {
            lastChangedAt: new Date().toISOString(),
            accounts: {
              ...s.accounts,
              [accountKey]: updateActiveProfile(account, (p) => ({ ...p, overrides: {}, growthPercent: 0 })),
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
                  { id, name: `${source.name} (2)`, createdAt: new Date().toISOString(), overrides: { ...source.overrides } },
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
          return {
            accounts: {
              ...s.accounts,
              [accountKey]: {
                ...updateActiveProfile(account, (p) => {
                  const overrides = Object.fromEntries(Object.entries(p.overrides).filter(([k]) => !k.startsWith(prefix)));
                  return { ...p, overrides };
                }),
                simulatedMedia: account.simulatedMedia.filter((m) => m.id !== mediaId),
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

      clearAccount: (accountKey) =>
        set((s) => {
          const next = { ...s.accounts };
          delete next[accountKey];
          return { accounts: next };
        }),
    }),
    {
      name: 'sociallens.simulation.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ enabled: state.enabled, accounts: state.accounts, lastChangedAt: state.lastChangedAt }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

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

export function countOverrides(overrides: Record<OverrideKey, number>, prefix?: string): number {
  return Object.keys(overrides).filter((k) => (prefix ? k.startsWith(prefix) : true)).length;
}

export const EMPTY_OVERRIDES: Record<OverrideKey, number> = Object.freeze({}) as Record<OverrideKey, number>;
export const EMPTY_SIMULATED_MEDIA: readonly SimulatedMedia[] = Object.freeze([]);
export const EMPTY_PROFILE_OVERRIDES: ProfileOverrides = Object.freeze({});
