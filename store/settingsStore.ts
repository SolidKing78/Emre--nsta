import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GrowthPreset } from '@/types/simulation';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Language = 'tr' | 'en';
export type EngagementFormula = 'reach' | 'followers';

interface SettingsState {
  theme: ThemePreference;
  language: Language;
  engagementFormula: EngagementFormula;
  defaultGrowthPreset: GrowthPreset;
  haptics: boolean;
  /** Off by default so scenario data renders exactly like the real Instagram UI; can be turned on in Settings. */
  showSimulationBadge: boolean;
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setEngagementFormula: (formula: EngagementFormula) => void;
  setDefaultGrowthPreset: (preset: GrowthPreset) => void;
  setHaptics: (enabled: boolean) => void;
  setShowSimulationBadge: (enabled: boolean) => void;
  setHydrated: (value: boolean) => void;
}

function detectLanguage(): Language {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    return code === 'tr' ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: detectLanguage(),
      engagementFormula: 'reach',
      defaultGrowthPreset: '+25%',
      haptics: true,
      showSimulationBadge: false,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setEngagementFormula: (engagementFormula) => set({ engagementFormula }),
      setDefaultGrowthPreset: (defaultGrowthPreset) => set({ defaultGrowthPreset }),
      setHaptics: (haptics) => set({ haptics }),
      setShowSimulationBadge: (showSimulationBadge) => set({ showSimulationBadge }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'sociallens.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        engagementFormula: state.engagementFormula,
        defaultGrowthPreset: state.defaultGrowthPreset,
        haptics: state.haptics,
        showSimulationBadge: state.showSimulationBadge,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
