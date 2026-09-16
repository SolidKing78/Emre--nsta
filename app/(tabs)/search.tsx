import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { CloseIcon, SearchIcon } from '@/components/icons';
import { fontStyles } from '@/constants/fonts';
import { radius, spacing } from '@/constants/theme';
import { useAccount } from '@/features/instagram/hooks';
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

/** Instagram search tab: type a username to open any public account (read-only). */
export default function SearchTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recent = useManualProfileStore((s) => s.recentPublicUsernames);
  const removeRecent = useManualProfileStore((s) => s.removeRecentPublic);
  const { data: account } = useAccount();

  const open = async (raw: string) => {
    const username = normalizeUsernameInput(raw);
    setError(null);
    if (!USERNAME_PATTERN.test(username)) {
      setError(t('public.invalidUsername'));
      triggerHaptic('warning');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      await signInPublic(username);
      triggerHaptic('success');
      router.replace('/(tabs)/profile');
    } catch (err) {
      const key = ERROR_KEY[toAppError(err).code];
      setError(key ? t(key) : t('error.unknown.body'));
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.secondaryButton }]}>
          <SearchIcon size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              if (error) setError(null);
            }}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => open(query)}
            style={[styles.input, { color: colors.text }]}
            accessibilityLabel={t('search.placeholder')}
            editable={!loading}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <CloseIcon size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {query.trim().length > 0 ? (
          <Pressable onPress={() => open(query)} style={styles.resultRow} accessibilityRole="button" accessibilityLabel={normalizeUsernameInput(query)}>
            <View style={[styles.resultAvatar, { backgroundColor: colors.secondaryButton }]}>
              <SearchIcon size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="feedStrong">{normalizeUsernameInput(query)}</Text>
              <Text variant="caption" color="secondary">
                {loading ? t('common.loading') : t('public.load')}
              </Text>
            </View>
          </Pressable>
        ) : null}
        {recent.length > 0 ? (
          <>
            <View style={styles.sectionRow}>
              <Text variant="title">{t('public.recent')}</Text>
            </View>
            {recent.map((username) => (
              <Pressable key={username} onPress={() => open(username)} style={styles.resultRow} accessibilityRole="button" accessibilityLabel={username}>
                <Avatar uri={account?.username === username ? account.profilePictureUrl : undefined} size={52} name={username} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text variant="feedStrong">{username}</Text>
                  <Text variant="caption" color="secondary">
                    {t('common.public')}
                  </Text>
                </View>
                <Pressable onPress={() => removeRecent(username)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                  <CloseIcon size={16} color={colors.textSecondary} />
                </Pressable>
              </Pressable>
            ))}
          </>
        ) : null}
        {query.trim().length === 0 && recent.length === 0 ? (
          <Text variant="body" color="secondary" style={{ padding: spacing.lg }}>
            {t('public.subtitle')}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: spacing.md, height: 42 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0, marginLeft: spacing.sm, ...fontStyles.regular },
  error: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  sectionRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  resultAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
});
