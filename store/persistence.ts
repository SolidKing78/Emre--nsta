import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/**
 * Persistence for the on-device stores (scenarios, settings, manual profiles).
 *
 *   - `durableStorage` never throws and never hands back unparsable JSON: a read
 *     failure or a corrupt value falls back to the last-known-good copy that every
 *     write leaves behind under `<key>.bak`, then to the defaults. A write cut short
 *     by the OS (app killed mid-save) therefore cannot lose the scenario.
 *   - `markHydrated` releases the splash screen even when rehydration failed —
 *     otherwise a single bad byte in storage would leave the app stuck on the splash.
 *
 * Stores stay on AsyncStorage (the phone's app sandbox): the data survives restarts
 * and updates, and only an uninstall / "clear data" removes it.
 */

const BACKUP_SUFFIX = '.bak';

function isJson(text: string | null): text is string {
  if (!text) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

async function quietly(task: Promise<unknown>): Promise<void> {
  try {
    await task;
  } catch {
    // Storage hiccups are never fatal for the UI.
  }
}

export const durableStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const primary = await AsyncStorage.getItem(name);
      if (isJson(primary)) return primary;
      const backup = await AsyncStorage.getItem(name + BACKUP_SUFFIX);
      if (isJson(backup)) {
        await quietly(AsyncStorage.setItem(name, backup));
        return backup;
      }
      if (primary !== null) await quietly(AsyncStorage.removeItem(name));
      return null;
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    await quietly(AsyncStorage.setItem(name, value));
    await quietly(AsyncStorage.setItem(name + BACKUP_SUFFIX, value));
  },
  removeItem: async (name) => {
    await quietly(AsyncStorage.multiRemove([name, name + BACKUP_SUFFIX]));
  },
};

interface Hydratable {
  setHydrated: (value: boolean) => void;
}

/**
 * Hydration bookkeeping for a persisted store: flips `hydrated` no matter what happened
 * (a failed read must not leave the app on the splash screen). The store is attached
 * right after creation because the handler has to be passed while the store is still
 * being built; hydration itself always completes asynchronously, after `attach`.
 */
export function hydrationHandler<T extends Hydratable>(after?: (state: T) => void) {
  let store: { getState: () => T } | null = null;
  return {
    attach(target: { getState: () => T }) {
      store = target;
    },
    onRehydrateStorage: () => (state: T | undefined, error?: unknown) => {
      if (error) console.warn('[persist] rehydration failed; continuing with defaults', error);
      const live = state ?? store?.getState();
      if (!live) return;
      live.setHydrated(true);
      after?.(live);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Small validators for `merge` / `migrate`                             */
/* ------------------------------------------------------------------ */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
