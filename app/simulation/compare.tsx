import * as Sharing from 'expo-sharing';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { AppHeader } from '@/components/common/AppHeader';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { MetricCardSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { ShareIcon } from '@/components/icons';
import { CompareTable, type CompareRow } from '@/components/simulation/CompareTable';
import { SimulationBadge } from '@/components/simulation/SimulationBadge';
import { APP_NAME } from '@/constants/config';
import { radius, spacing } from '@/constants/theme';
import { useContentPerformance } from '@/features/analytics/useContentPerformance';
import { flattenMedia, useAccount, useAccountInsights, useMediaFeed } from '@/features/instagram/hooks';
import { ACCOUNT_SCOPE, resolveWithGrowth, useActiveScenario, useGrowthPercent, useOverrides, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import type { MetricKey } from '@/types/app';
import { buildDateRange } from '@/utils/date';

const ACCOUNT_ROWS: MetricKey[] = ['views', 'reach', 'followers', 'interactions', 'profile_visits', 'website_clicks'];

/**
 * Before / After: real values vs the active scenario, side by side.
 * Always rendered with the SIMULATION label so screenshots cannot be mistaken for real data.
 */
export default function CompareScreen() {
  const { colors } = useTheme();
  const t = useT();
  const indicators = useSimulationIndicators();
  const overrides = useOverrides();
  const growth = useGrowthPercent();
  const scenario = useActiveScenario();
  const { data: account } = useAccount();
  const range = useMemo(() => buildDateRange('30d'), []);
  const insights = useAccountInsights(range);
  const feed = useMediaFeed();
  const media = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const real = useContentPerformance(media, account, { applySimulation: false });
  const simulated = useContentPerformance(media, account, { forceSimulation: true });
  const shotRef = useRef<ViewShotRef>(null);
  const [sharing, setSharing] = useState(false);

  const rows = useMemo<CompareRow[]>(() => {
    const metrics = insights.data?.metrics ?? [];
    const out: CompareRow[] = [];
    const sum = (items: { likes: number; comments: number }[], key: 'likes' | 'comments') => items.reduce((acc, i) => acc + i[key], 0);
    const pushAccount = (key: MetricKey) => {
      const realValue = metrics.find((m) => m.key === key)?.value ?? (key === 'followers' ? account?.followersCount : undefined);
      if (realValue === undefined) return;
      // Compare always previews the scenario, regardless of the switch.
      const sim = resolveWithGrowth(ACCOUNT_SCOPE, key, realValue, overrides, true, growth).displayValue;
      out.push({ label: t(`metric.${key}`), real: realValue, simulated: sim });
    };
    pushAccount('views');
    out.push({ label: t('metric.likes'), real: sum(real.items, 'likes'), simulated: sum(simulated.items, 'likes') });
    out.push({ label: t('metric.comments'), real: sum(real.items, 'comments'), simulated: sum(simulated.items, 'comments') });
    for (const key of ACCOUNT_ROWS.filter((k) => k !== 'views')) pushAccount(key);
    return out;
  }, [insights.data, account, overrides, growth, real.items, simulated.items, t]);

  const share = async () => {
    try {
      setSharing(true);
      const uri = await shotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('sim.compareTitle') });
        triggerHaptic('success');
      }
    } catch {
      triggerHaptic('error');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen>
      <AppHeader title={t('sim.compareTitle')} showBack right={indicators ? <SimulationBadge style={{ marginRight: spacing.sm }} /> : undefined} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {insights.isLoading && !insights.data ? (
          <MetricCardSkeleton />
        ) : insights.isError && !insights.data ? (
          <ErrorState error={insights.error} onRetry={() => insights.refetch()} compact />
        ) : (
          <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={[styles.shot, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
              <Avatar uri={account?.profilePictureUrl} size={40} name={account?.name} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text variant="bodyStrong">@{account?.username ?? ''}</Text>
                <Text variant="caption" color="secondary">
                  {t('metric.last30')} · {scenario?.name === 'Default' ? t('sim.defaultScenario') : (scenario?.name ?? '')}
                </Text>
              </View>
            </View>
            <CompareTable rows={rows} title={t('sim.compareTitle')} subtitle={t('sim.exportMarked')} />
            <Text variant="small" color="tertiary" align="center" style={{ marginTop: spacing.md }}>
              {indicators ? `${APP_NAME} · ${t('sim.badge')}` : APP_NAME}
            </Text>
          </ViewShot>
        )}
        <View style={styles.actions}>
          <Button title={t('common.share')} icon={<ShareIcon size={16} color="#fff" />} onPress={share} loading={sharing} />
          <Text variant="small" color="tertiary" align="center" style={{ marginTop: spacing.md }}>
            {t('sim.dataIsolation')}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shot: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  actions: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
});
