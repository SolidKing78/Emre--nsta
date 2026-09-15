import * as Linking from 'expo-linking';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { PressableScale } from '@/components/common/PressableScale';
import { Chip } from '@/components/common/Primitives';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { ChevronRightIcon, EditIcon, LinkIcon, VerifiedIcon } from '@/components/icons';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { radius, spacing } from '@/constants/theme';
import { ACCOUNT_SCOPE, useIsOverridden, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { AppAccount, MetricKey } from '@/types/app';
import { formatCompact } from '@/utils/format';

interface ProfileHeaderProps {
  /** Account with simulation applied (what the user sees). */
  account: AppAccount;
  /** Untouched account for the editor's "real value". */
  realAccount: AppAccount;
  viewsLast30?: number;
  onPressDashboard: () => void;
  onPressShare: () => void;
  onPressEditProfile: () => void;
  hasStory?: boolean;
}

function Stat({ value, label, metric, realValue, onPress }: { value: number; label: string; metric: MetricKey; realValue: number; onPress?: () => void }) {
  const editor = useMetricEditor();
  const indicators = useSimulationIndicators();
  const isOverridden = useIsOverridden()(ACCOUNT_SCOPE, metric) && indicators;
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={() => editor.open({ scope: ACCOUNT_SCOPE, metric, realValue })}
      delayLongPress={300}
      scaleTo={0.95}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={styles.stat}
    >
      <StatCounter value={value} variant="title" weight="700" color={isOverridden ? 'simulation' : 'primary'} style={styles.statValue} />
      <Text variant="caption" style={styles.statLabel}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function ProfileHeader({ account, realAccount, viewsLast30, onPressDashboard, onPressShare, onPressEditProfile, hasStory }: ProfileHeaderProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const indicators = useSimulationIndicators();
  const website = account.website?.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <Pressable
          onLongPress={onPressEditProfile}
          delayLongPress={300}
          accessibilityRole="image"
          accessibilityLabel={account.username}
        >
          <Avatar uri={account.profilePictureUrl} size={86} ring={hasStory ? 'gradient' : 'none'} name={account.name} />
          {indicators ? (
            <View style={[styles.avatarEdit, { backgroundColor: colors.simulation, borderColor: colors.background }]}>
              <EditIcon size={12} color="#fff" strokeWidth={2.4} />
            </View>
          ) : null}
        </Pressable>
        <View style={styles.stats}>
          <Stat value={account.mediaCount} label={t('profile.posts')} metric="media_count" realValue={realAccount.mediaCount} />
          <Stat value={account.followersCount} label={t('profile.followers')} metric="followers" realValue={realAccount.followersCount} />
          <Stat value={account.followsCount} label={t('profile.following')} metric="following" realValue={realAccount.followsCount} />
        </View>
      </View>

      <Pressable onLongPress={onPressEditProfile} delayLongPress={300} style={styles.bio} accessibilityRole="text">
        <View style={styles.nameRow}>
          <Text variant="feedStrong">{account.name}</Text>
          {account.isVerified ? <VerifiedIcon size={13} /> : null}
        </View>
        {account.category ? (
          <Text variant="feed" color="secondary">
            {account.category}
          </Text>
        ) : null}
        {account.biography ? <Text variant="feed">{account.biography}</Text> : null}
        {website ? (
          <Pressable
            onPress={() => {
              if (account.website) void Linking.openURL(account.website);
            }}
            style={styles.linkRow}
            accessibilityRole="link"
            accessibilityLabel={website}
          >
            <LinkIcon size={13} color={colors.link} />
            <Text variant="feedStrong" color="link" style={{ marginLeft: 4 }} numberOfLines={1}>
              {website}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>

      {viewsLast30 !== undefined ? (
        <PressableScale
          onPress={onPressDashboard}
          scaleTo={0.985}
          accessibilityRole="button"
          accessibilityLabel={t('profile.professionalDashboard')}
          style={[styles.dashboardRow, { backgroundColor: colors.secondaryButton }]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="feedStrong">{t('profile.professionalDashboard')}</Text>
            <Text variant="small" color="secondary" style={{ fontSize: 12, marginTop: 1 }}>
              {t('profile.viewsLast30', { n: formatCompact(viewsLast30, language) })}
            </Text>
          </View>
          <ChevronRightIcon size={16} color={colors.textSecondary} />
        </PressableScale>
      ) : null}

      <View style={styles.buttons}>
        <Button title={t('profile.editProfile')} variant="secondary" onPress={onPressEditProfile} style={styles.button} size="md" />
        <Button title={t('profile.shareProfile')} variant="secondary" onPress={onPressShare} style={styles.button} size="md" />
      </View>

      {indicators && account.source !== 'manual' ? (
        <View style={styles.simHint}>
          <Chip label={t('profile.simulatedProfileHint')} tone="simulation" small />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  avatarEdit: { position: 'absolute', right: 0, bottom: 2, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: spacing.xl },
  stat: { alignItems: 'center', minWidth: 64 },
  statValue: { fontSize: 17 },
  statLabel: { marginTop: 0, fontSize: 13 },
  bio: { marginTop: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dashboardRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, marginTop: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1, paddingHorizontal: spacing.sm },
  simHint: { marginTop: spacing.sm },
});
