import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontStyles } from '@/constants/fonts';
import { darkColors, lightColors, radius, spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render error anywhere below shows a small "try again"
 * screen instead of taking the whole app (and Expo Go) down. Persisted scenarios are
 * untouched — retry simply remounts the tree. Written without hooks so it works even
 * when the theme / i18n providers themselves are what failed.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    let dark = true;
    try {
      const preference = useSettingsStore.getState().theme;
      dark = preference !== 'light';
    } catch {
      // Fall back to the dark palette.
    }
    const colors = dark ? darkColors : lightColors;
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>{safeT('error.error.title', 'Bir şeyler ters gitti')}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{safeT('error.error.body', 'Bu ekran yüklenemedi. Lütfen tekrar deneyin.')}</Text>
        {__DEV__ ? (
          <Text style={[styles.detail, { color: colors.textTertiary }]} numberOfLines={6}>
            {String(this.state.error.message || this.state.error)}
          </Text>
        ) : null}
        <Pressable onPress={this.retry} accessibilityRole="button" style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={styles.buttonText}>{safeT('common.retry', 'Tekrar dene')}</Text>
        </Pressable>
      </View>
    );
  }
}

function safeT(key: Parameters<typeof t>[0], fallback: string): string {
  try {
    return t(key);
  } catch {
    return fallback;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  title: { fontSize: 20, textAlign: 'center', ...fontStyles.semibold },
  body: { fontSize: 15, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  detail: { fontSize: 12, textAlign: 'center', marginTop: spacing.md, fontFamily: 'monospace' },
  button: { marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  buttonText: { color: '#fff', fontSize: 15, ...fontStyles.semibold },
});
