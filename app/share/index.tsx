import * as Sharing from 'expo-sharing';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ViewShotRef } from 'react-native-view-shot';

import { ShareCard, type ShareMetric } from '@/components/analytics/ShareCard';
import { AppHeader } from '@/components/common/AppHeader';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { SegmentControl } from '@/components/common/SegmentControl';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { ShareIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useAccount, useAccountInsights } from '@/features/instagram/hooks';
import { ACCOUNT_SCOPE, useDisplayMetrics, useEffectiveAccount, useSimulationEnabled, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import type { DateRangePreset } from '@/types/app';
import { buildDateRange } from '@/utils/date';

/** Share Summary: story-sized report card export (first version of the export pipeline). */
export default function ShareSummaryScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const t = useT();
  const simulation = useSimulationEnabled();
  const indicators = useSimulationIndicators();
  const [preset, setPreset] = useState<Exclude<DateRangePreset, 'custom'>>('30d');
  const range = useMemo(() => buildDateRange(preset), [preset]);
  const { data: account } = useAccount();
  const effectiveAccount = useEffectiveAccount(account);
  const insights = useAccountInsights(range);
  const metrics = useDisplayMetrics(ACCOUNT_SCOPE, insights.data?.metrics);
  const shotRef = useRef<ViewShotRef>(null);
  const [sharing, setSharing] = useState(false);
  const [failed, setFailed] = useState(false);

  const cardWidth = Math.min(width - spacing.lg * 2, 360);
  const periodLabel = preset === '7d' ? t('share.last7') : preset === '90d' ? t('share.last90') : t('share.last30');
  const shareMetrics: ShareMetric[] = [];
  for (const [key, label] of [
    ['reach', 'metric.reach'],
    ['views', 'metric.views'],
    ['interactions', 'metric.interactions'],
    ['new_followers', 'metric.followers'],
  ] as const) {
    const m = metrics.find((x) => x.key === key);
    if (m) shareMetrics.push({ label: t(label), value: m.value, prefix: key === 'new_followers' ? '+' : undefined });
  }
  const anySimulated = simulation && metrics.some((m) => m.isSimulated);

  const share = async () => {
    setFailed(false);
    setSharing(true);
    try {
      const uri = await shotRef.current?.capture?.();
      if (!uri) throw new Error('capture failed');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.title') });
        triggerHaptic('success');
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
      triggerHaptic('error');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title={t('share.title')} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentControl
          value={preset}
          onChange={setPreset}
          options={[
            { value: '7d', label: t('range.7d') },
            { value: '30d', label: t('range.30d') },
            { value: '90d', label: t('range.90d') },
          ]}
        />
        <View style={styles.cardWrap}>
          {insights.isLoading && !insights.data ? (
            <Skeleton width={cardWidth} height={(cardWidth * 16) / 9} radius={radius.xl} />
          ) : insights.isError && !insights.data ? (
            <ErrorState error={insights.error} onRetry={() => insights.refetch()} compact />
          ) : effectiveAccount ? (
            <ShareCard ref={shotRef} account={effectiveAccount} periodLabel={periodLabel} metrics={shareMetrics} simulated={indicators && (anySimulated || simulation)} width={cardWidth} />
          ) : null}
        </View>
        {indicators ? (
          <Text variant="caption" color="simulation" align="center" style={{ marginBottom: spacing.md }}>
            {t('sim.exportMarked')}
          </Text>
        ) : null}
        {failed ? (
          <Text variant="caption" color="danger" align="center" style={{ marginBottom: spacing.md }}>
            {t('share.failed')}
          </Text>
        ) : null}
        <Button title={t('share.shareCard')} size="lg" icon={<ShareIcon size={18} color={colors.onPrimary} />} onPress={share} loading={sharing} disabled={!effectiveAccount || !insights.data} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  cardWrap: { alignItems: 'center', marginVertical: spacing.xl },
});
