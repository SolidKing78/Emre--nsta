import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppAccount, AppMedia } from '@/types/app';

import { durableStorage, hydrationHandler, isRecord, isString } from './persistence';

/**
 * Profiles built entirely by hand on the device (no Instagram involved).
 * Stored as normalized App types so the ManualInstagramProvider can serve them directly.
 */
export interface ManualProfile {
  id: string;
  account: AppAccount;
  media: AppMedia[];
  createdAt: string;
}

interface ManualProfileState {
  profiles: Record<string, ManualProfile>;
  recentPublicUsernames: string[];
  hydrated: boolean;
  upsertProfile: (profile: ManualProfile) => void;
  updateAccount: (id: string, patch: Partial<AppAccount>) => void;
  addMedia: (id: string, media: AppMedia) => void;
  removeMedia: (id: string, mediaId: string) => void;
  removeProfile: (id: string) => void;
  pushRecentPublic: (username: string) => void;
  removeRecentPublic: (username: string) => void;
  setHydrated: (value: boolean) => void;
}

function isManualProfile(value: unknown): value is ManualProfile {
  return isRecord(value) && isString(value.id) && isRecord(value.account) && isString(value.account.username) && Array.isArray(value.media);
}

const hydration = hydrationHandler<ManualProfileState>();

export const useManualProfileStore = create<ManualProfileState>()(
  persist(
    (set) => ({
      profiles: {},
      recentPublicUsernames: [],
      hydrated: false,
      upsertProfile: (profile) => set((s) => ({ profiles: { ...s.profiles, [profile.id]: profile } })),
      updateAccount: (id, patch) =>
        set((s) => {
          const existing = s.profiles[id];
          if (!existing) return {};
          return { profiles: { ...s.profiles, [id]: { ...existing, account: { ...existing.account, ...patch } } } };
        }),
      addMedia: (id, media) =>
        set((s) => {
          const existing = s.profiles[id];
          if (!existing) return {};
          return {
            profiles: {
              ...s.profiles,
              [id]: {
                ...existing,
                media: [media, ...existing.media],
                account: { ...existing.account, mediaCount: existing.account.mediaCount + 1 },
              },
            },
          };
        }),
      removeMedia: (id, mediaId) =>
        set((s) => {
          const existing = s.profiles[id];
          if (!existing) return {};
          return {
            profiles: {
              ...s.profiles,
              [id]: {
                ...existing,
                media: existing.media.filter((m) => m.id !== mediaId),
                account: { ...existing.account, mediaCount: Math.max(0, existing.account.mediaCount - 1) },
              },
            },
          };
        }),
      removeProfile: (id) =>
        set((s) => {
          const next = { ...s.profiles };
          delete next[id];
          return { profiles: next };
        }),
      pushRecentPublic: (username) =>
        set((s) => ({
          recentPublicUsernames: [username, ...s.recentPublicUsernames.filter((u) => u !== username)].slice(0, 8),
        })),
      removeRecentPublic: (username) =>
        set((s) => ({ recentPublicUsernames: s.recentPublicUsernames.filter((u) => u !== username) })),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'sociallens.manual.v1',
      storage: createJSONStorage(() => durableStorage),
      partialize: (state) => ({ profiles: state.profiles, recentPublicUsernames: state.recentPublicUsernames }),
      merge: (persisted, current) => {
        const saved = isRecord(persisted) ? persisted : {};
        const profiles: Record<string, ManualProfile> = {};
        if (isRecord(saved.profiles)) {
          for (const [id, value] of Object.entries(saved.profiles)) if (isManualProfile(value)) profiles[id] = value;
        }
        const recent = Array.isArray(saved.recentPublicUsernames) ? saved.recentPublicUsernames.filter(isString).slice(0, 20) : current.recentPublicUsernames;
        return { ...current, profiles, recentPublicUsernames: recent };
      },
      onRehydrateStorage: hydration.onRehydrateStorage,
    },
  ),
);
hydration.attach(useManualProfileStore);
