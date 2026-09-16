import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { CloseIcon, InfoIcon, SearchIcon } from '@/components/icons';
import { fontStyles } from '@/constants/fonts';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT, type TranslationKey } from '@/i18n';
import { normalizeUsernameInput, signInPublic } from '@/services/auth/authService';
import { USERNAME_PATTERN } from '@/services/instagram/PublicInstagramProvider';
import { useManualProfileStore } from '@/store/manualProfileStore';
import { toAppError } from '@/types/errors';

const ERROR_KEY: Record<string, TranslationKey> = {
  not_found: 'public.notFound',
  private_account: 'public.private',
  rate_limit: 'public.blocked',
  login_required: 'public.loginRequired',
  offline: 'error.offline.body',
  network: 'error.network.body',
};

/** Enter any public Instagram username → read-only profile with estimated insights. */
export default function PublicLookupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recent = useManualProfileStore((s) => s.recentPublicUsernames);
  const removeRecent = useManualProfileStore((s) => s.removeRecentPublic);

  const load = async (raw: string) => {
    const normalized = normalizeUsernameInput(raw);
    setError(null);
    if (!USERNAME_PATTERN.test(normalized)) {
      setError(t('public.invalidUsername'));
      triggerHaptic('warning');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      await signInPublic(normalized);
      triggerHaptic('success');
      router.replace('/(tabs)/home');
    } catch (err) {
      const appError = toAppError(err);
      const key = ERROR_KEY[appError.code];
      setError(key ? t(key) : t('error.unknown.body'));
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title={t('public.title')} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="body" color="secondary" style={styles.subtitle}>
          {t('public.subtitle')}
        </Text>

        <View style={[styles.inputWrap, { borderColor: error ? colors.danger : colors.borderStrong, backgroundColor: colors.surfaceElevated }]}>
          <SearchIcon size={18} color={colors.textSecondary} />
          <Text variant="body" color="secondary" style={{ marginLeft: spacing.sm }}>
            @
          </Text>
          <TextInput
            value={username}
            onChangeText={(v) => {
              setUsername(v);
              if (error) setError(null);
            }}
            placeholder={t('public.placeholder')}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={() => load(username)}
            style={[styles.input, { color: colors.text }]}
            accessibilityLabel={t('public.placeholder')}
          />
          {username.length > 0 ? (
            <Pressable onPress={() => setUsername('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <CloseIcon size={16} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <Text variant="caption" color="danger" style={{ marginTop: spacing.sm }}>
            {error}
          </Text>
        ) : null}
        <Button title={t('public.load')} size="lg" onPress={() => load(username)} loading={loading} disabled={username.trim().length === 0} style={{ marginTop: spacing.lg }} />

        {recent.length > 0 ? (
          <View style={styles.recent}>
            <Text variant="captionStrong" color="secondary" style={{ marginBottom: spacing.sm }}>
              {t('public.recent')}
            </Text>
            <View style={styles.recentRow}>
              {recent.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => {
                    setUsername(u);
                    void load(u);
                  }}
                  onLongPress={() => removeRecent(u)}
                  accessibilityRole="button"
                  accessibilityLabel={u}
                >
                  <Chip label={`@${u}`} tone="accent" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.hint, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <InfoIcon size={18} color={colors.textSecondary} strokeWidth={1.8} />
          <Text variant="caption" color="secondary" style={{ flex: 1, marginLeft: spacing.sm }}>
            {t('public.hint')}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  subtitle: { marginBottom: spacing.xl },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0, ...fontStyles.regular },
  recent: { marginTop: spacing.xxl },
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xxl },
});
