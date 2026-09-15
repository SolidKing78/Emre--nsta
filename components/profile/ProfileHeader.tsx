import * as Linking from 'expo-linking';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { PressableScale } from '@/components/common/PressableScale';
import { Chip } from '@/components/common/Primitives';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { ChevronRightIcon, EditIcon, LinkIcon, ThreadsIcon, VerifiedIcon, VerifiedOutlineIcon } from '@/components/icons';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { radius, spacing, touch } from '@/constants/theme';
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
  /** Long-press on the "Profesyonel pano" row: the scenario dials for the whole page. */
  onLongPressDashboard?: () => void;
  onPressShare: () => void;
  onPressEditProfile: () => void;
  hasStory?: boolean;
  /** The account you are signed in as (not someone else's public profile): note bubble, + story badge, Threads pill. */
  own?: boolean;
  /** Text of the note bubble above the avatar; the "Not…" placeholder when empty. */
  note?: string;
}

function Stat({ value, label, metric, realValue, onPress }: { value: number; label: string; metric: MetricKey; realValue: number; onPress?: () => void }) {
  const editor = useMetricEditor();
  const indicators = useSimulationIndicators();
  const isOverridden = useIsOverridden()(ACCOUNT_SCOPE, metric) && indicators;
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={() => editor.open({ scope: ACCOUNT_SCOPE, metric, realValue })}
      delayLongPress={touch.longPressMs}
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

export function ProfileHeader({ account, realAccount, viewsLast30, onPressDashboard, onLongPressDashboard, onPressShare, onPressEditProfile, hasStory, own = false, note }: ProfileHeaderProps) {
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
          delayLongPress={touch.longPressMs}
          accessibilityRole="image"
          accessibilityLabel={account.username}
          style={own ? styles.avatarWrap : undefined}
        >
          {own ? (
            <View style={[styles.note, { backgroundColor: colors.secondaryButton }]} pointerEvents="none">
              <Text variant="small" color={note ? 'primary' : 'secondary'} numberOfLines={2} align="center" style={styles.noteText}>
                {note ?? t('profile.notePlaceholder')}
              </Text>
              <View style={[styles.noteTail, { backgroundColor: colors.secondaryButton }]} />
            </View>
          ) : null}
          <Avatar uri={account.profilePictureUrl} size={86} ring={hasStory ? 'gradient' : 'none'} name={account.name} />
          {indicators ? (
            <View style={[styles.avatarEdit, { backgroundColor: colors.simulation, borderColor: colors.background }]}>
              <EditIcon size={12} color="#fff" strokeWidth={2.4} />
            </View>
          ) : own ? (
            <View style={[styles.avatarAdd, { backgroundColor: colors.text, borderColor: colors.background }]} accessibilityLabel={t('profile.addStory')}>
              <Text variant="bodyStrong" style={{ color: colors.background, fontSize: 18, lineHeight: 20, marginTop: -1 }}>
                +
              </Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.stats}>
          <Stat value={account.mediaCount} label={t('profile.posts')} metric="media_count" realValue={realAccount.mediaCount} />
          <Stat value={account.followersCount} label={t('profile.followers')} metric="followers" realValue={realAccount.followersCount} />
          <Stat value={account.followsCount} label={t('profile.following')} metric="following" realValue={realAccount.followsCount} />
        </View>
      </View>

      <Pressable onLongPress={onPressEditProfile} delayLongPress={touch.longPressMs} style={styles.bio} accessibilityRole="text">
        <View style={styles.nameRow}>
          <Text variant="feedStrong" style={{ fontSize: 16 }}>
            {account.name}
          </Text>
          {account.isVerified ? <VerifiedIcon size={14} /> : own ? <VerifiedOutlineIcon size={17} color={colors.textSecondary} /> : null}
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

      {own ? (
        <View style={styles.pills}>
          <Pressable
            onPress={() => void Linking.openURL(`https://www.threads.net/@${account.username}`)}
            style={[styles.pill, { backgroundColor: colors.secondaryButton }]}
            accessibilityRole="link"
            accessibilityLabel={t('profile.threads')}
          >
            <ThreadsIcon size={16} color={colors.text} />
            <Text variant="feedStrong" style={{ marginLeft: 6 }} numberOfLines={1}>
              {account.username}
            </Text>
          </Pressable>
          <Pressable onPress={onPressEditProfile} style={[styles.pill, { backgroundColor: colors.secondaryButton }]} accessibilityRole="button" accessibilityLabel={t('profile.addLink')}>
            <Text variant="feedStrong" color="secondary">
              + {t('profile.addLink')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {viewsLast30 !== undefined ? (
        <PressableScale
          onPress={onPressDashboard}
          onLongPress={onLongPressDashboard}
          delayLongPress={touch.longPressMs}
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
  avatarWrap: { marginTop: spacing.xl + 4 },
  note: { position: 'absolute', top: -40, left: -4, minWidth: 92, maxWidth: 124, paddingHorizontal: spacing.sm + 2, paddingVertical: 6, borderRadius: 16, zIndex: 2 },
  noteText: { fontSize: 12, lineHeight: 15 },
  noteTail: { position: 'absolute', bottom: -5, left: 20, width: 12, height: 12, borderRadius: 6 },
  avatarEdit: { position: 'absolute', right: 0, bottom: 2, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarAdd: { position: 'absolute', right: -2, bottom: 0, width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: spacing.xl },
  stat: { alignItems: 'center', minWidth: 64 },
  statValue: { fontSize: 19 },
  statLabel: { marginTop: 0, fontSize: 14 },
  pills: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm + 2 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, maxWidth: '60%' },
  bio: { marginTop: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dashboardRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, marginTop: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1, paddingHorizontal: spacing.sm },
  simHint: { marginTop: spacing.sm },
});
