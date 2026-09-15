import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GrowthRecommendationCard } from '@/components/analytics/GrowthRecommendationCard';
import { BarChart } from '@/components/charts/BarChart';
import { AppHeader } from '@/components/common/AppHeader';
import { Card, SectionTitle } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { InfoIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useContentPerformance } from '@/features/analytics/useContentPerformance';
import { flattenMedia, useAccount, useMediaFeed } from '@/features/instagram/hooks';
import { useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import { breakdownByType } from '@/services/analytics/content';
import { buildRecommendations, interactionsByHour } from '@/services/recommendations/rules';
import { formatCompact } from '@/utils/format';

/** Growth Lab: deterministic analysis on REAL data (simulation is ignored here on purpose). */
export default function GrowthLabScreen() {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const simulation = useSimulationIndicators();
  const { data: account, isError, error, refetch } = useAccount();
  const feed = useMediaFeed();
  const media = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const performance = useContentPerformance(media, account, { applySimulation: false });

  const recommendations = useMemo(
    () => (account ? buildRecommendations({ account, items: performance.items, insights: performance.insightsById, language }) : []),
    [account, performance.items, performance.insightsById, language],
  );
  const hours = useMemo(() => interactionsByHour(performance.items), [performance.items]);
  const types = useMemo(() => breakdownByType(performance.items), [performance.items]);
  const loading = feed.isLoading || (performance.isLoading && performance.items.length === 0);

  return (
    <Screen>
      <AppHeader title={t('growth.title')} showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          {t('growth.subtitle')}
        </Text>
        {simulation ? (
          <View style={[styles.notice, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <InfoIcon size={14} color={colors.textSecondary} />
            <Text variant="small" color="secondary" style={{ flex: 1, marginLeft: spacing.sm }}>
              {t('growth.simulationNote')}
            </Text>
          </View>
        ) : null}

        {isError && !account ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : loading ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <Skeleton height={150} radius={radius.lg} />
            <Skeleton height={150} radius={radius.lg} style={{ marginTop: spacing.md }} />
          </View>
        ) : (
          <>
            <SectionTitle title={t('growth.recommendations')} />
            <View style={{ paddingHorizontal: spacing.lg }}>
              {recommendations.map((r) => (
                <GrowthRecommendationCard key={r.id} item={r} />
              ))}
            </View>

            <SectionTitle title={t('growth.formatComparison')} />
            <Card style={styles.card}>
              {types.length === 0 ? (
                <Text variant="caption" color="secondary">
                  {t('growth.insufficientBody')}
                </Text>
              ) : (
                types.map((b, i) => (
                  <View key={b.type} style={[styles.typeRow, { borderBottomColor: colors.border, borderBottomWidth: i === types.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{t(`type.${b.type}`)}</Text>
                      <Text variant="small" color="secondary">
                        {b.count} · {t('metric.interactions').toLowerCase()} {formatCompact(b.avgInteractions, language)}
                      </Text>
                    </View>
                    <View style={styles.typeStat}>
                      <Text variant="captionStrong">{formatCompact(b.avgReach, language)}</Text>
                      <Text variant="small" color="tertiary">
                        {t('growth.avgReach')}
                      </Text>
                    </View>
                    <View style={styles.typeStat}>
                      <Text variant="captionStrong">{formatCompact(b.avgSaves, language)}</Text>
                      <Text variant="small" color="tertiary">
                        {t('growth.avgSaves')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <SectionTitle title={t('growth.bestHours')} />
            <Card style={styles.card}>
              {hours.some((h) => h.count > 0) ? (
                <BarChart
                  data={hours.map((h) => ({ label: `${h.hour.toString().padStart(2, '0')}`, value: Math.round(h.avgInteractions), detail: `${h.hour.toString().padStart(2, '0')}:00–${(h.hour + 2).toString().padStart(2, '0')}:00 · ${h.count}` }))}
                  height={160}
                  labelEvery={2}
                />
              ) : (
                <Text variant="caption" color="secondary">
                  {t('growth.insufficientBody')}
                </Text>
              )}
              <Text variant="small" color="tertiary" style={{ marginTop: spacing.sm }}>
                {t('metric.interactions')} · {t('analytics.dailyAverage').toLowerCase()}
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  notice: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.sm + 2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  card: { marginHorizontal: spacing.lg },
  typeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  typeStat: { alignItems: 'flex-end', minWidth: 64 },
});
