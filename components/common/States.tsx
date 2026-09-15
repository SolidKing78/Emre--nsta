import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CameraIcon, InfoIcon, LockIcon, RefreshIcon } from '@/components/icons';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useT, type TranslationKey } from '@/i18n';
import { toAppError, type AppErrorCode } from '@/types/errors';

import { Button } from './Button';
import { Text } from './Text';

interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function EmptyState({ title, body, icon, actionLabel, onAction, style, compact }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, compact && styles.compact, style]}>
      <View style={[styles.iconRing, { borderColor: colors.text }]}>{icon ?? <CameraIcon color={colors.text} size={34} strokeWidth={1.5} />}</View>
      <Text variant="heading" weight="700" align="center" style={styles.title}>
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="secondary" align="center" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="secondary" style={styles.action} /> : null}
    </View>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  onReconnect?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

const CODE_TO_KEY: Record<AppErrorCode, { title: TranslationKey; body: TranslationKey }> = {
  network: { title: 'error.network.title', body: 'error.network.body' },
  offline: { title: 'error.offline.title', body: 'error.offline.body' },
  rate_limit: { title: 'error.rate_limit.title', body: 'error.rate_limit.body' },
  auth_expired: { title: 'error.auth_expired.title', body: 'error.auth_expired.body' },
  insufficient_permission: { title: 'error.insufficient_permission.title', body: 'error.insufficient_permission.body' },
  not_professional: { title: 'error.not_professional.title', body: 'error.not_professional.body' },
  not_found: { title: 'error.not_found.title', body: 'error.not_found.body' },
  private_account: { title: 'error.private_account.title', body: 'error.private_account.body' },
  invalid_response: { title: 'error.invalid_response.title', body: 'error.invalid_response.body' },
  unsupported_metric: { title: 'error.unsupported_metric.title', body: 'error.unsupported_metric.body' },
  login_required: { title: 'error.login_required.title', body: 'error.login_required.body' },
  unknown: { title: 'error.unknown.title', body: 'error.unknown.body' },
};

/** Friendly error screen. Never dumps raw API errors. */
export function ErrorState({ error, onRetry, onReconnect, style, compact }: ErrorStateProps) {
  const { colors } = useTheme();
  const t = useT();
  const appError = toAppError(error);
  const keys = CODE_TO_KEY[appError.code] ?? CODE_TO_KEY.unknown;
  const icon =
    appError.code === 'auth_expired' || appError.code === 'login_required' || appError.code === 'private_account' ? (
      <LockIcon color={colors.text} size={32} strokeWidth={1.5} />
    ) : appError.code === 'not_professional' ? (
      <InfoIcon color={colors.text} size={32} strokeWidth={1.5} />
    ) : (
      <RefreshIcon color={colors.text} size={32} strokeWidth={1.5} />
    );
  return (
    <View style={[styles.root, compact && styles.compact, style]}>
      <View style={[styles.iconRing, { borderColor: colors.text }]}>{icon}</View>
      <Text variant="heading" weight="700" align="center" style={styles.title}>
        {t(keys.title)}
      </Text>
      <Text variant="body" color="secondary" align="center" style={styles.body}>
        {t(keys.body)}
      </Text>
      {appError.code === 'not_professional' ? (
        <Text variant="caption" color="tertiary" align="center" style={styles.body}>
          {t('error.not_professional.guide')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {appError.code === 'auth_expired' && onReconnect ? (
          <Button title={t('auth.reconnect')} onPress={onReconnect} style={styles.action} />
        ) : null}
        {onRetry ? <Button title={t('common.retry')} onPress={onRetry} variant="secondary" style={styles.action} /> : null}
      </View>
    </View>
  );
}

export function LoadingState({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, style]}>
      <ActivityIndicator color={colors.textSecondary} />
      {label ? (
        <Text variant="caption" color="secondary" style={{ marginTop: spacing.md }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxxl },
  compact: { flex: 0, paddingVertical: spacing.xl },
  iconRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { marginBottom: spacing.sm },
  body: { marginBottom: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.md },
  action: { marginHorizontal: spacing.xs, marginTop: spacing.sm, minWidth: 140 },
});
