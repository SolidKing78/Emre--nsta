import { useColorScheme } from 'react-native';

import { themes, type ThemeColors, type ThemeMode } from '@/constants/theme';
import { useSettingsStore } from '@/store/settingsStore';

export interface Theme {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const preference = useSettingsStore((s) => s.theme);
  const mode: ThemeMode = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return { colors: themes[mode], mode, isDark: mode === 'dark' };
}
