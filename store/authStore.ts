import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { DataSource } from '@/types/app';

import { hydrationHandler } from './persistence';

/**
 * App session. This is NOT an Instagram token.
 * In live mode `sessionToken` is an opaque token issued by the SocialLens backend,
 * which is the only place the encrypted Instagram access token lives.
 */
export interface AppSession {
  source: DataSource;
  /** Stable key used to namespace caches & simulation overlays, e.g. "public:natgeo" */
  accountKey: string;
  username: string;
  accountId?: string;
  sessionToken?: string;
  connectedAt: string;
  tokenExpiresAt?: string;
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'authExpired';

interface AuthState {
  session: AppSession | null;
  status: AuthStatus;
  hydrated: boolean;
  lastError?: string;
  signIn: (session: AppSession) => void;
  signOut: () => void;
  markExpired: () => void;
  setLastError: (message?: string) => void;
  setHydrated: (value: boolean) => void;
  touchSync: () => void;
}

const secureStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // Ignore — a failing secure store only means the session will not persist.
    }
  },
  removeItem: async (name) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // ignore
    }
  },
};

const hydration = hydrationHandler<AuthState>((state) => {
  if (state.status === 'loading') state.signOut();
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      status: 'loading',
      hydrated: false,
      lastError: undefined,
      signIn: (session) => set({ session, status: 'signedIn', lastError: undefined }),
      signOut: () => set({ session: null, status: 'signedOut' }),
      markExpired: () => set({ status: 'authExpired' }),
      setLastError: (lastError) => set({ lastError }),
      setHydrated: (hydrated) => set({ hydrated }),
      touchSync: () => set((s) => (s.session ? { session: { ...s.session } } : {})),
    }),
    {
      name: 'sociallens.session.v1',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ session: state.session, status: state.status === 'authExpired' ? 'authExpired' : undefined }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Pick<AuthState, 'session' | 'status'>>;
        const session = saved.session ?? null;
        const status: AuthStatus = session ? (saved.status === 'authExpired' ? 'authExpired' : 'signedIn') : 'signedOut';
        return { ...current, session, status };
      },
      onRehydrateStorage: hydration.onRehydrateStorage,
    },
  ),
);
hydration.attach(useAuthStore);

export function buildAccountKey(source: DataSource, identifier: string): string {
  return `${source}:${identifier.toLowerCase()}`;
}
