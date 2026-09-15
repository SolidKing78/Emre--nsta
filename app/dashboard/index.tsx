import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Divider, ListRow, ToggleRow } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import {
  BulbIcon,
  ChevronRightIcon,
  GearIcon,
  GraduationIcon,
  HandshakeIcon,
  HistoryIcon,
  TargetIcon,
  TrendUpIcon,
  TrialReelsIcon,
  UserIcon,
} from '@/components/icons';
import { GrowthRateSheet } from '@/components/simulation/GrowthRateEditor';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { radius, spacing } from '@/constants/theme';
import { deriveFollowerGrowth } from '@/features/analytics/useInsightsData';
import { flattenMedia, useAccount, useAccountInsights, useMediaFeed, useRefreshAll } from '@/features/instagram/hooks';
import { ACCOUNT_SCOPE, useDisplayMetrics, useEffectiveAccount, useEffectiveMedia, useGrowthPercent, useSimulationActions, useSimulationEnabled } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { MetricKey } from '@/types/app';
import { buildDateRange, formatShortDate, isWithinRange } from '@/utils/date';

/**
 * Instagram "Profesyonel pano":
 *   İstatistikler  → Görüntülemeler · Yeni takipçiler · Paylaştığın içerikler (date range on the right)
 *   Araçların      → Instagram's tool rows, mapped to SocialLens features
 * The gear opens the SocialLens scenario settings.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const editor = useMetricEditor();
  const simulation = useSimulationEnabled();
  const { setEnabled } = useSimulationActions();
  const growthPercent = useGrowthPercent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [igOnly, setIgOnly] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const range = useMemo(() => buildDateRange('30d'), []);

  const { data: account } = useAccount();
  const effectiveAccount = useEffectiveAccount(account);
  const insights = useAccountInsights(range);
  const feed = useMediaFeed();
  const refreshAll = useRefreshAll();
  const realMedia = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const media = useEffectiveMedia(realMedia, effectiveAccount);
  const sharedInRange = useMemo(() => media.filter((m) => isWithinRange(m.timestamp, range)).length, [media, range]);
  const metrics = useDisplayMetrics(ACCOUNT_SCOPE, insights.data?.metrics);
  const byKey = (key: MetricKey) => metrics.find((m) => m.key === key);
  const views = byKey('views');
  const newFollowers = byKey('new_followers');
  const growth = useMemo(() => deriveFollowerGrowth(newFollowers, effectiveAccount?.username ?? 'x'), [newFollowers, effectiveAccount?.username]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const openEditor = (key: MetricKey) => {
    const m = byKey(key);
    if (m) editor.open({ scope: ACCOUNT_SCOPE, metric: key, realValue: m.realValue });
  };

  const statRows: { key: MetricKey | null; label: string; value: number; onPress: () => void }[] = [
    { key: 'views', label: t('dashboard.viewsRow'), value: views?.value ?? 0, onPress: () => router.push('/insights') },
    { key: 'new_followers', label: t('dashboard.newFollowersRow'), value: growth.followsTotal, onPress: () => router.push('/insights?tab=audience') },
    { key: null, label: t('dashboard.sharedContentRow'), value: sharedInRange, onPress: () => router.push('/insights?tab=content') },
  ];

  const tools = [
    { title: t('dashboard.monthlySummary'), sub: t('dashboard.monthlySummarySub'), badge: t('dashboard.new'), icon: <HistoryIcon size={26} color={colors.text} strokeWidth={1.7} />, onPress: () => router.push('/share') },
    { title: t('dashboard.bestPractices'), icon: <GraduationIcon size={26} color={colors.text} strokeWidth={1.7} />, onPress: () => router.push('/growth') },
    { title: t('dashboard.inspiration'), icon: <BulbIcon size={26} color={colors.text} strokeWidth={1.7} />, onPress: () => router.push('/insights?tab=content') },
    { title: t('dashboard.brandedContent'), icon: <UserIcon size={26} color={colors.text} strokeWidth={1.7} />, onPress: () => setIgOnly(t('dashboard.brandedContent')) },
    { title: t('dashboard.partnershipAds'), icon: <HandshakeIcon size={26} color={colors.text} strokeWidth={1.7} />, onPress: () => setIgOnly(t('dashboard.partnershipAds')) },
    { title: t('dashboard.adTools'), icon: <TrendUpIcon size={26} color={colors.text} strokeWidth={1.7} />, onPress: () => setIgOnly(t('dashboard.adTools')) },
    { title: t('dashboard.competitorInsights'), sub: t('dashboard.competitorSub'), icon: <TargetIcon size={26} color={colors.text} strokeWidth={1.7} />, onPress: () => router.push('/(tabs)/search') },
    { title: t('dashboard.trialReels'), icon: <TrialReelsIcon size={26} color={colors.text} strokeWidth={1.7} />, onPress: () => router.push('/reels') },
  ];

  const rangeText = `${formatShortDate(range.since, language)} - ${formatShortDate(range.until, language)}`;

  return (
    <Screen>
      <AppHeader
        centered={false}
        title={t('dashboard.title')}
        showBack
        right={
          <IconButton accessibilityLabel={t('dashboard.settingsTitle')} onPress={() => setSettingsOpen(true)}>
            <GearIcon size={26} color={colors.text} strokeWidth={1.6} />
          </IconButton>
        }
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      >
        {/* ---------------- İstatistikler ---------------- */}
        <View style={styles.sectionHeader}>
          <Text variant="heading" weight="600">
            {t('dashboard.stats')}
          </Text>
          <Text variant="body" color="secondary">
            {rangeText}
          </Text>
        </View>
        {insights.isLoading && !insights.data ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Skeleton width="100%" height={22} style={{ marginVertical: spacing.lg }} />
            <Skeleton width="100%" height={22} style={{ marginVertical: spacing.lg }} />
            <Skeleton width="100%" height={22} style={{ marginVertical: spacing.lg }} />
          </View>
        ) : insights.isError && !insights.data ? (
          <ErrorState error={insights.error} onRetry={() => insights.refetch()} compact />
        ) : (
          statRows.map((row) => (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              onLongPress={row.key ? () => openEditor(row.key!) : undefined}
              delayLongPress={300}
              style={styles.statRow}
              accessibilityRole="button"
              accessibilityLabel={`${row.label} ${row.value}`}
            >
              <Text variant="body" style={{ flex: 1 }}>
                {row.label}
              </Text>
              <StatCounter value={row.value} format={row.value < 10_000 ? 'full' : 'compact'} variant="body" style={{ fontSize: 17 }} />
              <ChevronRightIcon size={16} color={colors.textSecondary} />
            </Pressable>
          ))
        )}

        <View style={[styles.thick, { backgroundColor: colors.surfaceElevated }]} />

        {/* ---------------- Araçların ---------------- */}
        <View style={styles.sectionHeader}>
          <Text variant="heading" weight="600">
            {t('dashboard.yourTools')}
          </Text>
          <Pressable onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel={t('common.seeAll')}>
            <Text variant="body" style={{ color: '#4C5BF0' }}>
              {t('common.seeAll')}
            </Text>
          </Pressable>
        </View>
        {tools.map((tool) => (
          <Pressable key={tool.title} onPress={tool.onPress} style={styles.toolRow} accessibilityRole="button" accessibilityLabel={tool.title}>
            <View style={styles.toolIcon}>{tool.icon}</View>
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontSize: 17 }}>
                {tool.title}
              </Text>
              {tool.sub ? (
                <Text variant="body" color="secondary" numberOfLines={1}>
                  {tool.sub}
                </Text>
              ) : null}
            </View>
            {tool.badge ? (
              <View style={styles.badge}>
                <Text variant="bodyStrong" style={{ color: '#fff' }}>
                  {tool.badge}
                </Text>
              </View>
            ) : null}
            <ChevronRightIcon size={16} color={colors.textSecondary} />
          </Pressable>
        ))}
      </ScrollView>

      {/* ---------------- Gear: SocialLens scenario settings ---------------- */}
      <BottomSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('dashboard.settingsTitle')}>
        <ToggleRow
          title={t('sim.badgeLong')}
          value={simulation}
          onValueChange={(v) => {
            triggerHaptic(v ? 'medium' : 'light');
            setEnabled(v);
          }}
        />
        <Divider inset={spacing.lg} />
        <ListRow
          title={t('growthRate.title')}
          subtitle={growthPercent !== 0 ? `${t('growthRate.current')}: ${growthPercent > 0 ? '+' : ''}${growthPercent}%` : t('dashboard.growthRateSub')}
          onPress={() => {
            setSettingsOpen(false);
            setTimeout(() => setGrowthOpen(true), 250);
          }}
        />
        <Divider inset={spacing.lg} />
        {(
          [
            [t('dashboard.simulationLab'), '/simulation'],
            [t('dashboard.compare'), '/simulation/compare'],
            [t('dashboard.growthLab'), '/growth'],
            [t('dashboard.reels'), '/reels'],
            [t('dashboard.account'), '/account'],
            [t('dashboard.appSettings'), '/settings'],
          ] as [string, string][]
        ).map(([title, route], i, arr) => (
          <View key={route}>
            <ListRow
              title={title}
              onPress={() => {
                setSettingsOpen(false);
                setTimeout(() => router.push(route as never), 220);
              }}
            />
            {i < arr.length - 1 ? <Divider inset={spacing.lg} /> : null}
          </View>
        ))}
      </BottomSheet>

      <GrowthRateSheet visible={growthOpen} onClose={() => setGrowthOpen(false)} previewMetrics={insights.data?.metrics} />

      <BottomSheet visible={Boolean(igOnly)} onClose={() => setIgOnly(null)} title={igOnly ?? ''}>
        <View style={styles.igOnly}>
          <Text variant="title">{t('dashboard.igOnlyTitle')}</Text>
          <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
            {t('dashboard.igOnlyBody')}
          </Text>
          <Button
            title={t('dashboard.openInstagram')}
            variant="secondary"
            onPress={() => {
              setIgOnly(null);
              void Linking.openURL('https://www.instagram.com/');
            }}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md },
  thick: { height: 6, marginVertical: spacing.md },
  toolRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md },
  toolIcon: { width: 32, alignItems: 'center', marginRight: spacing.xs },
  badge: { backgroundColor: '#4C5BF0', borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8, marginRight: spacing.xs },
  igOnly: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
