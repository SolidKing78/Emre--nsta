import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ReelCard } from '@/components/analytics/ReelCard';
import { AppHeader } from '@/components/common/AppHeader';
import { Card } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { Skeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { ReelsIcon } from '@/components/icons';
import { SimulationBadge } from '@/components/simulation/SimulationBadge';
import { radius, spacing } from '@/constants/theme';
import { useContentPerformance } from '@/features/analytics/useContentPerformance';
import { flattenMedia, useAccount, useMediaFeed } from '@/features/instagram/hooks';
import { useEffectiveAccount, useEffectiveMedia, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import { sortPerformance } from '@/services/analytics/content';
import { formatCompact } from '@/utils/format';

export default function ReelsAnalyticsScreen() {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const simulation = useSimulationIndicators();
  const { data: account } = useAccount();
  const effectiveAccount = useEffectiveAccount(account);
  const feed = useMediaFeed();
  const realMedia = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const media = useEffectiveMedia(realMedia, effectiveAccount);
  const reels = useMemo(() => media.filter((m) => m.type === 'REEL'), [media]);
  const performance = useContentPerformance(reels, effectiveAccount);
  const sorted = useMemo(() => sortPerformance(performance.items, 'views'), [performance.items]);
  const totalViews = performance.items.reduce((acc, i) => acc + i.views, 0);
  const avgViews = performance.items.length ? totalViews / performance.items.length : 0;

  return (
    <Screen>
      <AppHeader title={t('reels.title')} showBack right={simulation ? <SimulationBadge style={{ marginRight: spacing.sm }} /> : undefined} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {feed.isLoading ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Skeleton height={190} radius={radius.lg} />
            <Skeleton height={190} radius={radius.lg} style={{ marginTop: spacing.md }} />
          </View>
        ) : reels.length === 0 ? (
          <EmptyState title={t('profile.noReelsTitle')} body={t('reels.empty')} icon={<ReelsIcon color={colors.text} size={32} strokeWidth={1.5} />} />
        ) : (
          <>
            <Card style={styles.summary} tone={simulation ? 'simulation' : 'default'}>
              <View style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color="secondary">
                    {t('reels.totalViews')}
                  </Text>
                  <Text variant="metric" weight="700" color={simulation ? 'simulation' : 'primary'}>
                    {formatCompact(totalViews, language)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color="secondary">
                    {t('reels.avgViews')}
                  </Text>
                  <Text variant="metric" weight="700" color={simulation ? 'simulation' : 'primary'}>
                    {formatCompact(avgViews, language)}
                  </Text>
                </View>
              </View>
              <Text variant="small" color="tertiary" style={{ marginTop: spacing.xs }}>
                {reels.length} {t('type.REEL')}
              </Text>
            </Card>
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              {sorted.map((item) => (
                <ReelCard key={item.media.id} item={item} insight={performance.insightsById[item.media.id]} simulated={simulation} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
});
