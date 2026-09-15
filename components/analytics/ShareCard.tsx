import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { Avatar } from '@/components/common/Avatar';
import { Text } from '@/components/common/Text';
import { FlaskIcon } from '@/components/icons';
import { APP_NAME } from '@/constants/config';
import { radius, spacing } from '@/constants/theme';
import { upperCase, useLanguage, useT } from '@/i18n';
import type { AppAccount } from '@/types/app';
import { formatCompact } from '@/utils/format';

export interface ShareMetric {
  label: string;
  value: number;
  prefix?: string;
}

interface ShareCardProps {
  account: AppAccount;
  periodLabel: string;
  metrics: ShareMetric[];
  /** Show the scenario label on the card (Settings → show scenario badge). */
  simulated: boolean;
  width: number;
}

/** Instagram-story sized (9:16) summary card. The scenario label is optional (Settings). */
export const ShareCard = forwardRef<ViewShotRef, ShareCardProps>(function ShareCard({ account, periodLabel, metrics, simulated, width }, ref) {
  const t = useT();
  const language = useLanguage();
  const height = Math.round((width * 16) / 9);
  const gradient: [string, string, string] = ['#0B0B0F', '#1F1B3A', '#0095F6'];
  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }} style={{ width, height, borderRadius: radius.xl, overflow: 'hidden' }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Avatar uri={account.profilePictureUrl} size={56} name={account.name} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text variant="title" style={styles.light} numberOfLines={1}>
                @{account.username}
              </Text>
              <Text variant="caption" style={styles.muted} numberOfLines={1}>
                {account.name}
              </Text>
            </View>
            {simulated ? (
              <View style={styles.simBadge}>
                <FlaskIcon size={12} color="#3B1D8F" strokeWidth={2.4} />
                <Text variant="small" style={styles.simBadgeText}>
                  {t('sim.badge')}
                </Text>
              </View>
            ) : null}
          </View>

          <Text variant="heading" style={[styles.light, { marginTop: spacing.xxxl }]}>
            {periodLabel}
          </Text>
          <View style={styles.metrics}>
            {metrics.map((m) => (
              <View key={m.label} style={styles.metricRow}>
                <Text variant="body" style={styles.muted}>
                  {m.label}
                </Text>
                <Text variant="display" style={[styles.light, { fontSize: 34, lineHeight: 40 }]}>
                  {m.prefix ?? ''}
                  {formatCompact(m.value, language)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            {simulated ? (
              <Text variant="caption" style={[styles.light, { fontWeight: '700', letterSpacing: 1 }]}>
                {upperCase(t('sim.badgeLong'), language)} · {upperCase(t('common.onlyVisibleToYou'), language)}
              </Text>
            ) : null}
            <Text variant="caption" style={styles.muted}>
              {APP_NAME} · {t('brand.tagline')}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </ViewShot>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  inner: { flex: 1, padding: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center' },
  light: { color: '#FFFFFF' },
  muted: { color: 'rgba(255,255,255,0.72)' },
  simBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  simBadgeText: { color: '#3B1D8F', fontWeight: '700', marginLeft: 4, letterSpacing: 0.6 },
  metrics: { marginTop: spacing.xl, gap: spacing.lg },
  metricRow: {},
  footer: { marginTop: 'auto', gap: spacing.xs },
});
