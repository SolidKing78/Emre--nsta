import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppAccount, AppMedia } from '@/types/app';

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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ profiles: state.profiles, recentPublicUsernames: state.recentPublicUsernames }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
