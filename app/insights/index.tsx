import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AudienceTab } from '@/components/analytics/insights/AudienceTab';
import { ContentTab } from '@/components/analytics/insights/ContentTab';
import { OverviewTab } from '@/components/analytics/insights/OverviewTab';
import { TopTabs } from '@/components/analytics/insights/primitives';
import { AppHeader } from '@/components/common/AppHeader';
import { BottomSheet } from '@/components/common/BottomSheet';
import { IconButton } from '@/components/common/IconButton';
import { ListRow } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { CheckIcon, InfoIcon } from '@/components/icons';
import { AudienceMixSheet } from '@/components/simulation/AudienceMixEditor';
import { StatPercentSheet, type StatEdit } from '@/components/simulation/StatPercentSheet';
import { radius, spacing } from '@/constants/theme';
import { insightRange, useInsightsData, type InsightRangeDays } from '@/features/analytics/useInsightsData';
import { useRefreshAll, useSession } from '@/features/instagram/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useT, type TranslationKey } from '@/i18n';

type Tab = 'overview' | 'content' | 'audience';

const RANGE_LABEL: Record<InsightRangeDays, TranslationKey> = {
  7: 'insights.range7',
  14: 'insights.range14',
  30: 'insights.range30',
  90: 'insights.range90',
  365: 'insights.range365',
};

/** Instagram "İstatistikler": Genel bakış · İçerik · Hedef kitle. */
export default function InsightsScreen() {
  const { tab: initialTab } = useLocalSearchParams<{ tab?: Tab }>();
  const { colors } = useTheme();
  const t = useT();
  const session = useSession();
  const [tab, setTab] = useState<Tab>(initialTab === 'content' || initialTab === 'audience' ? initialTab : 'overview');
  const [overviewDays, setOverviewDays] = useState<InsightRangeDays>(30);
  const [contentDays, setContentDays] = useState<InsightRangeDays>(365);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [statEdit, setStatEdit] = useState<StatEdit | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const days = tab === 'content' ? contentDays : overviewDays;
  const range = useMemo(() => insightRange(days), [days]);
  const data = useInsightsData(range);
  const refreshAll = useRefreshAll();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const infoKey: TranslationKey =
    session?.source === 'demo' ? 'insights.infoDemo' : session?.source === 'public' ? 'insights.infoPublic' : session?.source === 'manual' ? 'insights.infoManual' : 'insights.infoLive';

  const rangeOptions: InsightRangeDays[] = tab === 'content' ? [7, 30, 90, 365] : [7, 14, 30, 90];

  return (
    <Screen>
      <AppHeader
        title={t('insights.title')}
        showBack
        centered={false}
        right={
          <IconButton accessibilityLabel={t('insights.infoTitle')} onPress={() => setInfoOpen(true)}>
            <InfoIcon size={26} color={colors.text} strokeWidth={1.6} />
          </IconButton>
        }
      />
      <TopTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: t('insights.overview') },
          { value: 'content', label: t('insights.content') },
          { value: 'audience', label: t('insights.audience') },
        ]}
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        {data.isLoading && !data.insights.data ? (
          <View style={styles.loading}>
            <Skeleton width={180} height={26} />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <Skeleton width={176} height={110} radius={radius.lg} />
              <Skeleton width={176} height={110} radius={radius.lg} />
            </View>
            <Skeleton width="100%" height={220} style={{ marginTop: spacing.xl }} />
          </View>
        ) : data.error && !data.insights.data ? (
          <ErrorState error={data.error} onRetry={data.refetch} />
        ) : tab === 'overview' ? (
          <OverviewTab data={data} rangeLabel={t(RANGE_LABEL[days])} onOpenRange={() => setRangeOpen(true)} onInfo={() => setInfoOpen(true)} />
        ) : tab === 'content' ? (
          <ContentTab data={data} rangeLabel={t(RANGE_LABEL[days])} onOpenRange={() => setRangeOpen(true)} />
        ) : (
          <AudienceTab
            data={data}
            range={range}
            rangeLabel={t(RANGE_LABEL[days])}
            onOpenRange={() => setRangeOpen(true)}
            onInfo={() => setInfoOpen(true)}
            onEditAudience={() => setAudienceOpen(true)}
            onEditBucket={(group, label, value, isCustom) => setStatEdit({ key: `${group}.${label}`, title: label, subtitle: t('insights.audience'), value, isCustom })}
          />
        )}
      </ScrollView>

      <BottomSheet visible={rangeOpen} onClose={() => setRangeOpen(false)} title={t('insights.rangeTitle')}>
        {rangeOptions.map((option) => (
          <ListRow
            key={option}
            title={t(RANGE_LABEL[option])}
            chevron={false}
            right={option === days ? <CheckIcon size={18} color={colors.primary} /> : null}
            onPress={() => {
              if (tab === 'content') setContentDays(option);
              else setOverviewDays(option);
              setRangeOpen(false);
            }}
          />
        ))}
      </BottomSheet>

      <AudienceMixSheet visible={audienceOpen} onClose={() => setAudienceOpen(false)} />
      <StatPercentSheet edit={statEdit} onClose={() => setStatEdit(null)} />

      <BottomSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title={t('insights.infoTitle')}>
        <View style={styles.info}>
          <Text variant="body" color="secondary">
            {t(infoKey)}
          </Text>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { padding: spacing.lg },
  info: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
