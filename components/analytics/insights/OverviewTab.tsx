import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { Divider } from '@/components/common/Primitives';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { CommentIcon, ExternalIcon, HeartIcon, RefreshIcon, ShareIcon, ShopIcon, UserIcon } from '@/components/icons';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { radius, spacing, touch } from '@/constants/theme';
import type { useInsightsData, InteractionKind } from '@/features/analytics/useInsightsData';
import { ACCOUNT_SCOPE } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { MetricKey } from '@/types/app';
import { formatCompact, formatPercent } from '@/utils/format';

import { ChipRow, DropdownButton, InsightBars, LegendDots, SectionHeading, ThickDivider } from './primitives';

type Card = { key: MetricKey; labelKey: 'insights.cardViews' | 'insights.cardNetFollowers' | 'insights.cardInteractions' | 'insights.cardReach' | 'insights.cardProfileVisits' };

const CARDS: Card[] = [
  { key: 'views', labelKey: 'insights.cardViews' },
  { key: 'new_followers', labelKey: 'insights.cardNetFollowers' },
  { key: 'interactions', labelKey: 'insights.cardInteractions' },
  { key: 'reach', labelKey: 'insights.cardReach' },
  { key: 'profile_visits', labelKey: 'insights.cardProfileVisits' },
];

interface OverviewTabProps {
  data: ReturnType<typeof useInsightsData>;
  rangeLabel: string;
  onOpenRange: () => void;
  onInfo: () => void;
}

export function OverviewTab({ data, rangeLabel, onOpenRange, onInfo }: OverviewTabProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const editor = useMetricEditor();
  const [selected, setSelected] = useState<MetricKey>('views');
  const [kind, setKind] = useState<InteractionKind>('all');

  const selectedMetric = data.byKey(selected);
  const series = selectedMetric?.series ?? [];
  const isNet = selected === 'new_followers';
  const chartSeries = isNet ? data.growth.total : series;
  const followerPct = Math.round(data.followerShare * 1000) / 10;
  const nonFollowerPct = Math.round((100 - followerPct) * 10) / 10;
  const viewsByType = data.byType;
  const viewers = data.byKey('reach')?.value ?? 0;
  const interactionRows = useMemo(() => data.interactionsByType(kind), [data, kind]);

  const chipIcon = (node: React.ReactNode) => node;

  return (
    <View>
      {/* ---- header row: Tüm içerikler · 30 gün ▾ ---- */}
      <View style={styles.headerRow}>
        <Text variant="display" weight="600" style={{ fontSize: 24 }}>
          {t('insights.allContent')}
        </Text>
        <DropdownButton label={rangeLabel} onPress={onOpenRange} large />
      </View>

      {/* ---- metric cards ---- */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {CARDS.map((card) => {
          const m = data.byKey(card.key);
          if (!m) return null;
          const active = selected === card.key;
          const value = card.key === 'new_followers' ? data.growth.netTotal : m.value;
          return (
            <Pressable
              key={card.key}
              onPress={() => setSelected(card.key)}
              onLongPress={() => editor.open({ scope: ACCOUNT_SCOPE, metric: card.key, realValue: m.realValue })}
              delayLongPress={touch.longPressMs}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${t(card.labelKey)} ${value}`}
              style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: active ? colors.text : 'transparent' }]}
            >
              <Text variant="body" color="secondary" numberOfLines={1}>
                {t(card.labelKey)}
              </Text>
              <StatCounter value={value} format={Math.abs(value) < 10_000 ? 'full' : 'compact'} variant="display" weight="600" style={{ fontSize: 26, marginTop: spacing.sm }} />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.split}>
        <Text variant="body">
          <Text variant="bodyStrong">{formatPercent(followerPct, language, 1).replace('+', '')}</Text> {t('insights.followersShare', { p: '' }).trim()}
        </Text>
        <Text variant="body">
          <Text variant="bodyStrong">{formatPercent(nonFollowerPct, language, 1).replace('+', '')}</Text> {t('insights.nonFollowersShare', { p: '' }).trim()}
        </Text>
      </View>

      <View style={styles.chart}>
        {chartSeries.length > 1 ? (
          <LineChart data={chartSeries} height={230} allowNegative={isNet} />
        ) : (
          <Text variant="body" color="secondary" style={{ padding: spacing.lg }}>
            {t('insights.noData')}
          </Text>
        )}
      </View>

      <ThickDivider />

      {/* ---- views by content type ---- */}
      <SectionHeading title={t('insights.viewsByType')} onInfo={onInfo} />
      <Pressable
        onLongPress={() => data.byKey('reach') && editor.open({ scope: ACCOUNT_SCOPE, metric: 'reach', realValue: data.byKey('reach')!.realValue })}
        delayLongPress={touch.longPressMs}
        style={styles.viewersRow}
        accessibilityRole="button"
        accessibilityLabel={`${t('insights.viewers')} ${viewers}`}
      >
        <Text variant="title">{t('insights.viewers')}</Text>
        <Text variant="title">{formatCompact(viewers, language)}</Text>
      </Pressable>
      <Divider style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }} />
      <LegendDots
        items={[
          { label: t('insights.legendFollowers'), color: colors.chartLine },
          { label: t('insights.legendNonFollowers'), color: colors.chartLineSoft },
        ]}
      />
      <InsightBars
        rows={[
          { label: t('insights.typePosts'), value: viewsByType.posts.views, split: data.followerShare },
          { label: t('insights.typeStories'), value: viewsByType.stories.views, split: data.followerShare },
          { label: t('insights.typeReels'), value: viewsByType.reels.views, split: data.followerShare },
          { label: t('insights.typeLive'), value: viewsByType.live.views, split: data.followerShare },
        ]}
      />

      {/* ---- interactions by content type ---- */}
      <SectionHeading title={t('insights.interactionsByType')} onInfo={onInfo} />
      <ChipRow<InteractionKind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'all', label: t('insights.chipAll') },
          { value: 'likes', label: t('insights.chipLikes'), icon: chipIcon(<HeartIcon size={18} color={colors.text} />) },
          { value: 'comments', label: t('insights.chipComments'), icon: chipIcon(<CommentIcon size={18} color={colors.text} strokeWidth={1.8} />) },
          { value: 'reposts', label: t('insights.chipReposts'), icon: chipIcon(<RefreshIcon size={18} color={colors.text} strokeWidth={1.8} />) },
          { value: 'shares', label: t('insights.chipShares'), icon: chipIcon(<ShareIcon size={18} color={colors.text} strokeWidth={1.8} />) },
          { value: 'saves', label: t('insights.chipSaves') },
        ]}
      />
      <LegendDots
        items={[
          { label: t('insights.legendFollowers'), color: colors.chartLine },
          { label: t('insights.legendNonFollowers'), color: colors.chartLineSoft },
        ]}
      />
      <InsightBars
        rows={[
          { label: t('insights.typePosts'), value: interactionRows.posts, split: data.followerShare },
          { label: t('insights.typeStories'), value: interactionRows.stories, split: data.followerShare },
          { label: t('insights.typeReels'), value: interactionRows.reels, split: data.followerShare },
          { label: t('insights.typeLive'), value: interactionRows.live, split: data.followerShare },
        ]}
      />

      {/* ---- profile activity ---- */}
      <SectionHeading title={t('insights.profileActivity')} onInfo={onInfo} />
      {(
        [
          { key: 'profile_visits' as MetricKey, label: t('insights.profileVisits'), icon: <UserIcon size={26} color={colors.text} strokeWidth={1.6} /> },
          { key: 'website_clicks' as MetricKey, label: t('insights.bioLinkTaps'), icon: <ExternalIcon size={24} color={colors.text} strokeWidth={1.6} /> },
          { key: null, label: t('insights.addressTaps'), icon: <ShopIcon size={24} color={colors.text} strokeWidth={1.6} /> },
        ] as { key: MetricKey | null; label: string; icon: React.ReactNode }[]
      ).map((row) => {
        const m = row.key ? data.byKey(row.key) : undefined;
        const value = m?.value ?? 0;
        return (
          <Pressable
            key={row.label}
            onLongPress={m && row.key ? () => editor.open({ scope: ACCOUNT_SCOPE, metric: row.key!, realValue: m.realValue }) : undefined}
            delayLongPress={touch.longPressMs}
            style={styles.activityRow}
            accessibilityRole="button"
            accessibilityLabel={`${row.label} ${value}`}
          >
            <View style={[styles.activityIcon, { backgroundColor: colors.secondaryButton }]}>{row.icon}</View>
            <Text variant="body" style={{ flex: 1 }}>
              {row.label}
            </Text>
            <StatCounter value={value} format="full" variant="title" weight="600" />
          </Pressable>
        );
      })}
      <View style={{ height: spacing.xxxl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  cards: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: 176, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 2 },
  split: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: 4 },
  chart: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  viewersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  activityIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg },
});
