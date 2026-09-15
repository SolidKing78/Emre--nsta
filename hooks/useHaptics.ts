import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

type Impact = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

const IMPACT: Record<'light' | 'medium' | 'heavy', Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

const NOTIFY: Record<'success' | 'warning' | 'error', Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

export function triggerHaptic(kind: Impact = 'light'): void {
  if (Platform.OS === 'web') return;
  if (!useSettingsStore.getState().haptics) return;
  try {
    if (kind === 'selection') {
      void Haptics.selectionAsync();
    } else if (kind === 'success' || kind === 'warning' || kind === 'error') {
      void Haptics.notificationAsync(NOTIFY[kind]);
    } else {
      void Haptics.impactAsync(IMPACT[kind]);
    }
  } catch {
    // Haptics unavailable on this device — ignore.
  }
}

export function useHaptics() {
  return useCallback((kind: Impact = 'light') => triggerHaptic(kind), []);
}
