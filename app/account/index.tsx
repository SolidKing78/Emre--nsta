import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Chip, Divider, ListRow, SectionTitle } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { RefreshIcon, VerifiedIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useAccount, useRefreshAll, useSession } from '@/features/instagram/hooks';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import { signOut } from '@/services/auth/authService';
import { useAuthStore } from '@/store/authStore';
import type { ApiStatus, AppAccount } from '@/types/app';
import type { AppSession } from '@/store/authStore';
import { formatLongDate, formatRelativeShort } from '@/utils/date';
import { formatNumber } from '@/utils/format';

function apiStatusFor(session: AppSession | null, account: AppAccount | undefined, error: unknown, authStatus: string): ApiStatus {
  if (!session) return 'auth_required';
  if (session.source === 'demo') return 'demo';
  if (session.source === 'public') return error && !account ? 'sync_error' : 'public';
  if (session.source === 'manual') return 'manual';
  if (authStatus === 'authExpired') return 'auth_required';
  if (error && !account) return 'sync_error';
  if (session.tokenExpiresAt) {
    const daysLeft = (new Date(session.tokenExpiresAt).getTime() - Date.now()) / 86_400_000;
    if (daysLeft <= 0) return 'auth_required';
    if (daysLeft < 7) return 'token_expiring';
  }
  return 'connected';
}

/** Account overview: username, type, media count, connected since, last sync, API status. */
export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const session = useSession();
  const authStatus = useAuthStore((s) => s.status);
  const client = useQueryClient();
  const { data: account, isLoading, error, refetch } = useAccount();
  const refreshAll = useRefreshAll();
  const [syncing, setSyncing] = useState(false);

  const status = apiStatusFor(session, account, error, authStatus);
  const statusTone = status === 'connected' || status === 'public' || status === 'demo' || status === 'manual' ? 'success' : status === 'token_expiring' ? 'warning' : 'danger';

  const sync = async () => {
    setSyncing(true);
    try {
      await refreshAll();
      triggerHaptic('success');
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = () =>
    Alert.alert(t('auth.disconnect'), t('auth.disconnectConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.disconnect'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          client.clear();
          router.replace('/(auth)/connect');
        },
      },
    ]);

  return (
    <Screen>
      <AppHeader title={t('account.title')} showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {isLoading && !account ? (
          <View style={{ padding: spacing.lg }}>
            <Skeleton height={80} radius={radius.lg} />
            <Skeleton height={240} radius={radius.lg} style={{ marginTop: spacing.md }} />
          </View>
        ) : error && !account ? (
          <ErrorState error={error} onRetry={() => refetch()} onReconnect={() => router.replace('/(auth)/reconnect')} />
        ) : account ? (
          <>
            <View style={styles.hero}>
              <Avatar uri={account.profilePictureUrl} size={64} name={account.name} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text variant="title">{account.name}</Text>
                  {account.isVerified ? <VerifiedIcon size={14} /> : null}
                </View>
                <Text variant="caption" color="secondary">
                  @{account.username}
                </Text>
              </View>
              <Chip label={t(`account.status.${status}`)} tone={statusTone} />
            </View>

            <SectionTitle title={t('account.overview')} />
            <View style={[styles.box, { borderColor: colors.borderStrong }]}>
              <ListRow title={t('account.username')} right={<Text variant="body" color="secondary">@{account.username}</Text>} chevron={false} />
              <Divider inset={spacing.lg} />
              <ListRow title={t('account.accountType')} right={<Text variant="body" color="secondary">{t(`account.type.${account.accountType}`)}</Text>} chevron={false} />
              <Divider inset={spacing.lg} />
              <ListRow title={t('account.mediaCount')} right={<Text variant="body" color="secondary">{formatNumber(account.mediaCount, language)}</Text>} chevron={false} />
              <Divider inset={spacing.lg} />
              <ListRow title={t('account.connectedSince')} right={<Text variant="body" color="secondary">{formatLongDate(session?.connectedAt ?? account.connectedAt ?? new Date().toISOString(), language)}</Text>} chevron={false} />
              <Divider inset={spacing.lg} />
              <ListRow title={t('account.lastSync')} right={<Text variant="body" color="secondary">{account.lastSyncAt ? formatRelativeShort(account.lastSyncAt, language) : '—'}</Text>} chevron={false} />
              <Divider inset={spacing.lg} />
              <ListRow title={t('account.apiStatus')} right={<Chip label={t(`account.status.${status}`)} tone={statusTone} small />} chevron={false} />
              {session?.tokenExpiresAt ? (
                <>
                  <Divider inset={spacing.lg} />
                  <ListRow title={t('account.tokenExpires')} right={<Text variant="body" color="secondary">{formatLongDate(session.tokenExpiresAt, language)}</Text>} chevron={false} />
                </>
              ) : null}
              <Divider inset={spacing.lg} />
              <ListRow title={t('account.source')} subtitle={t(`account.dataSourceNote.${session?.source ?? 'demo'}`)} right={<Text variant="body" color="secondary">{t(`common.${session?.source ?? 'demo'}`)}</Text>} chevron={false} />
            </View>

            <View style={styles.actions}>
              <Button title={t('account.syncNow')} variant="secondary" icon={<RefreshIcon size={16} color={colors.text} />} onPress={sync} loading={syncing} />
              {status === 'auth_required' || status === 'token_expiring' ? (
                <Button title={t('auth.reconnect')} onPress={() => router.replace('/(auth)/reconnect')} style={{ marginTop: spacing.sm }} />
              ) : null}
              <Button title={t('profile.switchAccount')} variant="secondary" onPress={() => router.push('/(auth)/connect')} style={{ marginTop: spacing.sm }} />
              <Button title={t('auth.disconnect')} variant="ghost" onPress={disconnect} style={{ marginTop: spacing.sm }} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  box: { marginHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, overflow: 'hidden' },
  actions: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
});
