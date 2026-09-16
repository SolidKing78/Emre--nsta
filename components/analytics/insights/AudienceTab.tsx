import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { spacing, touch } from '@/constants/theme';
import { useIsAccountBucketCustom } from '@/features/analytics/useAudienceSplits';
import type { useInsightsData } from '@/features/analytics/useInsightsData';
import { ACCOUNT_SCOPE, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { DateRange } from '@/types/app';
import { formatShortDate } from '@/utils/date';
import { formatPercent, formatShare } from '@/utils/format';

import { ChipRow, DropdownButton, InsightBars, SectionHeading } from './primitives';

type GrowthView = 'total' | 'follows' | 'unfollows';

interface AudienceTabProps {
  data: ReturnType<typeof useInsightsData>;
  range: DateRange;
  rangeLabel: string;
  onOpenRange: () => void;
  onInfo: () => void;
  /** Long-press on the gender split opens the audience mix editor. */
  onEditAudience?: () => void;
  /** Long-press on an age / city / country bar opens the percentage editor. */
  onEditBucket?: (group: 'age' | 'city' | 'country', label: string, value: number, isCustom: boolean) => void;
}

/** Instagram "Hedef kitle" tab: followers, growth over time, gender, age, cities, countries, active times. */
export function AudienceTab({ data, range, rangeLabel, onOpenRange, onInfo, onEditAudience, onEditBucket }: AudienceTabProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const editor = useMetricEditor();
  const indicators = useSimulationIndicators();
  const isCustom = useIsAccountBucketCustom();
  const [view, setView] = useState<GrowthView>('total');

  const pct = (value: number) => formatShare(value, language);
  /** Every demographic bar is long-pressable; the value it shows is what the editor opens on. */
  const bucketRows = (group: 'age' | 'city' | 'country', buckets: readonly { label: string; value: number }[]) =>
    buckets.map((b) => ({ key: `${group}.${b.label}`, label: b.label, value: b.value, display: pct(b.value), custom: indicators && isCustom(group, b.label) }));
  const onBucketLongPress = (group: 'age' | 'city' | 'country') => (row: { label: string; value: number }) =>
    onEditBucket?.(group, row.label, row.value, isCustom(group, row.label));

  const followers = data.effectiveAccount?.followersCount ?? 0;
  const realFollowers = data.account?.followersCount ?? followers;
  const startFollowers = Math.max(1, followers - data.growth.netTotal);
  const changePct = ((followers - startFollowers) / startFollowers) * 100;
  const series = view === 'total' ? data.growth.total : view === 'follows' ? data.growth.follows : data.growth.unfollows;
  const audience = data.audience;

  return (
    <View>
      <View style={styles.headerRow}>
        <Text variant="display" weight="600" style={{ fontSize: 24 }}>
          {t('insights.followers')}
        </Text>
        <DropdownButton label={rangeLabel} onPress={onOpenRange} large />
      </View>
      <Pressable
        onLongPress={() => editor.open({ scope: ACCOUNT_SCOPE, metric: 'followers', realValue: realFollowers })}
        delayLongPress={touch.longPressMs}
        style={styles.big}
        accessibilityRole="button"
        accessibilityLabel={`${t('insights.followers')} ${followers}`}
      >
        <StatCounter value={followers} format={followers < 10_000 ? 'full' : 'compact'} variant="display" weight="600" style={{ fontSize: 40, lineHeight: 46 }} />
        <Text variant="body" color="secondary" style={{ marginTop: 4 }}>
          {t('insights.sinceDate', { p: formatPercent(changePct, language, 1), date: formatShortDate(range.since, language) })}
        </Text>
      </Pressable>

      <SectionHeading title={t('insights.followerGrowth')} style={{ paddingTop: spacing.xxl }} />
      <ChipRow<GrowthView>
        value={view}
        onChange={setView}
        options={[
          { value: 'total', label: t('insights.growthTotal') },
          { value: 'follows', label: t('insights.growthFollows') },
          { value: 'unfollows', label: t('insights.growthUnfollows') },
        ]}
      />
      <View style={styles.chart}>
        {series.length > 1 ? (
          <LineChart data={series} height={220} allowNegative={view === 'total'} />
        ) : (
          <Text variant="body" color="secondary" style={{ padding: spacing.lg }}>
            {t('insights.noData')}
          </Text>
        )}
      </View>

      {audience ? (
        <>
          <SectionHeading title={t('insights.gender')} onInfo={onInfo} />
          <Pressable onLongPress={onEditAudience} delayLongPress={touch.longPressMs} accessibilityRole="button" accessibilityLabel={t('insights.gender')}>
            <InsightBars
              max={100}
              rows={[
                { key: 'men', label: t('insights.men'), value: audience.gender.men, display: pct(audience.gender.men) },
                { key: 'women', label: t('insights.women'), value: audience.gender.women, display: pct(audience.gender.women) },
              ]}
              onRowLongPress={onEditAudience}
            />
          </Pressable>

          <SectionHeading title={t('insights.ageRange')} onInfo={onInfo} />
          <InsightBars max={100} rows={bucketRows('age', audience.ages)} onRowLongPress={onBucketLongPress('age')} />

          <SectionHeading title={t('insights.topCities')} onInfo={onInfo} />
          <InsightBars max={100} rows={bucketRows('city', audience.cities)} onRowLongPress={onBucketLongPress('city')} />

          <SectionHeading title={t('insights.topCountries')} onInfo={onInfo} />
          <InsightBars max={100} rows={bucketRows('country', audience.countries)} onRowLongPress={onBucketLongPress('country')} />

          <SectionHeading title={t('insights.activeTimes')} onInfo={onInfo} />
          <View style={styles.chart}>
            <BarChart
              data={audience.activeHours.map((v, h) => ({ label: `${h}`, value: Math.round(v * 100), detail: `${h.toString().padStart(2, '0')}:00` }))}
              height={150}
              color={colors.chartLine}
              labelEvery={6}
              formatValue={(v) => `${Math.round(v)}%`}
            />
          </View>
        </>
      ) : null}
      <View style={{ height: spacing.xxxl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  big: { paddingHorizontal: spacing.lg },
  chart: { paddingHorizontal: spacing.lg },
});
