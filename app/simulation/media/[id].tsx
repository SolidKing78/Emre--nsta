import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetricRow } from '@/components/analytics/MetricRow';
import { AppHeader } from '@/components/common/AppHeader';
import { Button } from '@/components/common/Button';
import { Card, Chip } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { PostSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { CompareTable, type CompareRow } from '@/components/simulation/CompareTable';
import { ModeSwitch } from '@/components/simulation/ModeSwitch';
import { SimulationBadge } from '@/components/simulation/SimulationBadge';
import { radius, spacing } from '@/constants/theme';
import { useMediaDetail } from '@/features/instagram/useMediaDetail';
import { useDisplayMetrics, useSimulationActions, useSimulationEnabled, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { upperCase, useLanguage, useT } from '@/i18n';
import { completePostMetrics } from '@/services/analytics/postInsights';
import type { AppMetric, MetricKey } from '@/types/app';
import { GROWTH_PRESETS, SIMULATABLE_MEDIA_METRICS } from '@/types/simulation';
import { formatLongDate } from '@/utils/date';

/** Post-level simulation: likes, comments, views, reach, shares, saves… */
export default function MediaSimulationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const enabled = useSimulationEnabled();
  const indicators = useSimulationIndicators();
  const actions = useSimulationActions();
  const detail = useMediaDetail(id);

  // The same metric set the "Gönderi istatistikleri" screen shows, so edits line up 1:1.
  const baseMetrics = useMemo<AppMetric[]>(() => {
    if (!detail.realMedia) return [];
    const complete = completePostMetrics(detail.realMedia, detail.realInsight);
    return SIMULATABLE_MEDIA_METRICS.map((key) => complete.find((m) => m.key === key)).filter((m): m is AppMetric => Boolean(m));
  }, [detail.realInsight, detail.realMedia]);
  const metrics = useDisplayMetrics(detail.scope, baseMetrics);

  const applyPreset = (factor: number) => {
    actions.applyFactor(
      baseMetrics.map((m) => ({ scope: detail.scope, metric: m.key, realValue: m.value })),
      factor,
    );
    if (!enabled) actions.setEnabled(true);
    triggerHaptic('success');
  };

  const resetPost = () => {
    for (const key of SIMULATABLE_MEDIA_METRICS as MetricKey[]) actions.clearOverride(detail.scope, key);
    triggerHaptic('warning');
  };

  const compareRows: CompareRow[] = metrics.map((m) => ({ label: t(`metric.${m.key}`), real: m.realValue, simulated: m.value }));

  if (detail.error && !detail.media) {
    return (
      <Screen>
        <AppHeader title={t('media.simulate')} showBack />
        <ErrorState error={detail.error} onRetry={detail.refetch} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={t('media.simulate')} showBack right={indicators ? <SimulationBadge style={{ marginRight: spacing.sm }} /> : undefined} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <ModeSwitch style={styles.switch} />
        {!detail.media ? (
          <PostSkeleton />
        ) : (
          <>
            <Pressable onPress={() => router.push(`/media/${detail.media?.id}`)} style={[styles.postRow, { borderColor: colors.borderStrong }]} accessibilityRole="button" accessibilityLabel={detail.media.caption.slice(0, 40)}>
              <Image source={{ uri: detail.media.thumbnailUrl }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Chip label={t(`type.${detail.media.type}`)} small />
                  {detail.media.isSimulated ? <Chip label={t('feed.simulatedPost')} tone="simulation" small /> : null}
                </View>
                <Text variant="caption" numberOfLines={2} style={{ marginTop: spacing.xs }}>
                  {detail.media.caption || t(`type.${detail.media.type}`)}
                </Text>
                <Text variant="small" color="tertiary" style={{ marginTop: 2 }}>
                  {formatLongDate(detail.media.timestamp, language)}
                </Text>
              </View>
            </Pressable>

            <Text variant="captionStrong" color="secondary" style={styles.sectionLabel}>
              {upperCase(t('sim.presets'), language)}
            </Text>
            <View style={styles.presets}>
              {GROWTH_PRESETS.map((p) => (
                <Pressable key={p.label} onPress={() => applyPreset(p.factor)} accessibilityRole="button" accessibilityLabel={p.label} style={[styles.preset, { backgroundColor: colors.secondaryButton }]}>
                  <Text variant="captionStrong">{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text variant="captionStrong" color="secondary" style={styles.sectionLabel}>
              {upperCase(t('sim.postMetrics'), language)}
            </Text>
            <Card style={styles.card} tone={indicators ? 'simulation' : 'default'}>
              {metrics.map((m, i) => (
                <MetricRow key={m.key} metric={m} scope={detail.scope} last={i === metrics.length - 1} subtitle={detail.media?.caption.split('\n')[0]} />
              ))}
              {metrics.length === 0 ? (
                <Text variant="caption" color="secondary">
                  {detail.insightsLoading ? t('common.loading') : t('media.notAvailable')}
                </Text>
              ) : null}
            </Card>
            <Text variant="small" color="tertiary" style={styles.hint}>
              {t('sim.longPressHint')}
            </Text>

            {compareRows.length > 0 ? (
              <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl }}>
                <CompareTable rows={compareRows} title={t('sim.compareTitle')} subtitle={detail.media.caption.split('\n')[0]} />
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button title={t('sim.resetToReal')} variant="secondary" onPress={resetPost} />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  postRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  thumb: { width: 64, height: 80, borderRadius: radius.sm },
  sectionLabel: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm, letterSpacing: 0.4 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  preset: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  card: { marginHorizontal: spacing.lg, paddingVertical: spacing.xs },
  hint: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  actions: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
});
