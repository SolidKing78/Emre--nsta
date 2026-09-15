import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { PressableScale } from '@/components/common/PressableScale';
import { Screen } from '@/components/common/Screen';
import { Skeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { FlaskIcon, HeartIcon, RefreshIcon, SparkIcon, TrendUpIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useActivity } from '@/features/activity/useActivity';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { AppActivityItem } from '@/types/app';
import { formatRelativeShort } from '@/utils/date';
import { formatCompact, formatNumber } from '@/utils/format';

function bucketOf(iso: string, now: Date): 'today' | 'thisWeek' | 'thisMonth' | 'earlier' {
  const diff = now.getTime() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day) return 'today';
  if (diff < 7 * day) return 'thisWeek';
  if (diff < 30 * day) return 'thisMonth';
  return 'earlier';
}

export default function ActivityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const { items, isLoading } = useActivity();
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => {
    const now = new Date();
    const groups: Record<string, AppActivityItem[]> = { today: [], thisWeek: [], thisMonth: [], earlier: [] };
    for (const item of items) groups[bucketOf(item.timestamp, now)]?.push(item);
    return (['today', 'thisWeek', 'thisMonth', 'earlier'] as const)
      .filter((k) => (groups[k]?.length ?? 0) > 0)
      .map((k) => ({ key: k, title: t(`activity.${k}`), data: groups[k] ?? [] }));
  }, [items, t]);

  const describe = (item: AppActivityItem): { primary: string; secondary?: string; bold?: string } => {
    switch (item.kind) {
      case 'like':
        return { bold: item.title, primary: t('activity.likedYourPost') };
      case 'comment':
        return { bold: item.title, primary: t('activity.commented', { text: item.subtitle ?? '' }) };
      case 'follow':
        if (item.title === 'newFollowers') return { primary: t('activity.newFollowers', { n: formatNumber(Number(item.subtitle ?? 0), language) }) };
        return { bold: item.title, primary: t('activity.startedFollowing') };
      case 'sync':
        return { primary: t('activity.sync', { source: t(`common.${(item.subtitle as 'demo' | 'live' | 'public' | 'manual') ?? 'demo'}`) }) };
      case 'milestone':
        if (item.title === 'reach') return { primary: t('activity.milestone.reach', { n: formatCompact(Number(item.subtitle ?? 0), language) }) };
        if (item.title === 'followers') return { primary: t('activity.milestone.followers', { n: formatCompact(Number(item.subtitle ?? 0), language) }) };
        return { primary: t('activity.topPost') };
      case 'recommendation':
        return { primary: t('activity.recommendation') };
      case 'simulation':
        return { primary: t('activity.simulation', { name: item.title }) };
      default:
        return { primary: item.title };
    }
  };

  const iconFor = (item: AppActivityItem) => {
    const size = 40;
    const wrap = (bg: string, node: React.ReactNode) => <View style={[styles.iconWrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>{node}</View>;
    switch (item.kind) {
      case 'sync':
        return wrap(colors.secondaryButton, <RefreshIcon size={20} color={colors.text} />);
      case 'milestone':
        return wrap('rgba(31,168,85,0.14)', <TrendUpIcon size={20} color={colors.success} />);
      case 'recommendation':
        return wrap('rgba(0,149,246,0.14)', <SparkIcon size={20} color={colors.primary} />);
      case 'simulation':
        return wrap(colors.simulationSoft, <FlaskIcon size={20} color={colors.simulation} />);
      case 'like':
        return item.avatarUrl ? <Avatar uri={item.avatarUrl} size={size} name={item.title} /> : wrap(colors.secondaryButton, <HeartIcon size={20} color={colors.like} filled />);
      default:
        return <Avatar uri={item.avatarUrl} size={size} name={item.title} />;
    }
  };

  return (
    <Screen>
      <AppHeader centered={false} title={t('activity.title')} />
      {isLoading && items.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Skeleton width="70%" height={12} />
                <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <Text variant="title">{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const text = describe(item);
            const isUser = item.kind === 'follow' && item.title !== 'newFollowers';
            return (
              <PressableScale
                onPress={item.route ? () => router.push(item.route as never) : undefined}
                scaleTo={0.99}
                haptic={false}
                accessibilityRole={item.route ? 'button' : 'text'}
                accessibilityLabel={`${text.bold ?? ''} ${text.primary}`}
                style={styles.row}
              >
                {iconFor(item)}
                <View style={styles.rowText}>
                  <Text variant="feed" numberOfLines={3}>
                    {text.bold ? <Text variant="feedStrong">{text.bold} </Text> : null}
                    {text.primary}
                    <Text variant="feed" color="secondary">
                      {' '}
                      {formatRelativeShort(item.timestamp, language)}
                    </Text>
                  </Text>
                </View>
                {item.mediaThumbnailUrl ? (
                  <Image source={{ uri: item.mediaThumbnailUrl }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
                ) : isUser ? (
                  <Button
                    title={following[item.id] ? t('activity.following') : t('activity.follow')}
                    size="sm"
                    variant={following[item.id] ? 'secondary' : 'primary'}
                    onPress={() => setFollowing((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    style={styles.followButton}
                  />
                ) : null}
              </PressableScale>
            );
          }}
          ListEmptyComponent={<EmptyState title={t('activity.empty')} icon={<HeartIcon color={colors.text} size={32} />} />}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, gap: spacing.md },
  rowText: { flex: 1 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm },
  followButton: { minWidth: 92 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
});
