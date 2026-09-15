import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { GROWTH_PRESETS, type GrowthPreset } from '@/types/simulation';

import { durableStorage, hydrationHandler, isRecord, oneOf } from './persistence';

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

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES: readonly Language[] = ['tr', 'en'];
const FORMULAS: readonly EngagementFormula[] = ['reach', 'followers'];
const PRESET_LABELS = GROWTH_PRESETS.map((p) => p.label);

const hydration = hydrationHandler<SettingsState>();

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
      storage: createJSONStorage(() => durableStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        engagementFormula: state.engagementFormula,
        defaultGrowthPreset: state.defaultGrowthPreset,
        haptics: state.haptics,
        showSimulationBadge: state.showSimulationBadge,
      }),
      // Every persisted value is checked against its allowed set; anything else keeps the default.
      merge: (persisted, current) => {
        const saved = isRecord(persisted) ? persisted : {};
        return {
          ...current,
          theme: oneOf(saved.theme, THEMES, current.theme),
          language: oneOf(saved.language, LANGUAGES, current.language),
          engagementFormula: oneOf(saved.engagementFormula, FORMULAS, current.engagementFormula),
          defaultGrowthPreset: oneOf(saved.defaultGrowthPreset, PRESET_LABELS, current.defaultGrowthPreset),
          haptics: typeof saved.haptics === 'boolean' ? saved.haptics : current.haptics,
          showSimulationBadge: typeof saved.showSimulationBadge === 'boolean' ? saved.showSimulationBadge : current.showSimulationBadge,
        };
      },
      onRehydrateStorage: hydration.onRehydrateStorage,
    },
  ),
);
hydration.attach(useSettingsStore);
