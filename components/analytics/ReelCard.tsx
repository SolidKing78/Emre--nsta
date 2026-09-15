import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';
import { Chip } from '@/components/common/Primitives';
import { Text } from '@/components/common/Text';
import { PlayIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { lowerCase, useLanguage, useT } from '@/i18n';
import type { ContentPerformance } from '@/services/analytics/content';
import type { AppMediaInsight } from '@/types/app';
import { metricValue } from '@/types/app';
import { formatCompact, formatDuration } from '@/utils/format';

interface ReelCardProps {
  item: ContentPerformance;
  insight?: AppMediaInsight;
  simulated?: boolean;
}

/** Reel preview with its metrics; retention only when the source provides it. */
export function ReelCard({ item, insight, simulated }: ReelCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const indicators = useSimulationIndicators();
  const { media } = item;
  const hasRetention = Boolean(insight?.retention && insight.retention.length > 3);
  const avgWatch = insight ? metricValue(insight.metrics, 'avg_watch_time', -1) : -1;
  const hook = hasRetention ? Math.round((insight?.retention?.[3] ?? 0) * 100) : null;

  const metrics: { label: string; value: string }[] = [
    { label: t('metric.views'), value: formatCompact(item.views, language) },
    { label: t('metric.reach'), value: formatCompact(item.reach, language) },
    { label: t('metric.likes'), value: formatCompact(item.likes, language) },
    { label: t('metric.comments'), value: formatCompact(item.comments, language) },
    { label: t('metric.shares'), value: formatCompact(item.shares, language) },
    { label: t('metric.saves'), value: formatCompact(item.saves, language) },
    { label: t('metric.interactions'), value: formatCompact(item.interactions, language) },
  ];

  return (
    <PressableScale onPress={() => router.push(`/media/${media.id}`)} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={media.caption.slice(0, 40)} style={[styles.card, { borderColor: simulated && indicators ? colors.simulation : colors.borderStrong }]}>
      <View style={styles.preview}>
        <Image source={{ uri: media.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} />
        <View style={styles.play}>
          <PlayIcon size={22} />
        </View>
        <View style={styles.views}>
          <PlayIcon size={12} />
          <Text variant="small" style={styles.viewsText}>
            {formatCompact(item.views, language)}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text variant="captionStrong" numberOfLines={2}>
          {media.caption.split('\n')[0] || t('type.REEL')}
        </Text>
        <View style={styles.grid}>
          {metrics.map((m) => (
            <View key={m.label} style={styles.cell}>
              <Text variant="captionStrong">{m.value}</Text>
              <Text variant="small" color="tertiary" numberOfLines={1}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          {hasRetention && hook !== null ? (
            <Chip label={`3s ${lowerCase(t('media.retention'), language)} ${hook}%`} tone={hook >= 75 ? 'success' : hook >= 55 ? 'accent' : 'warning'} small />
          ) : (
            <Chip label={t('reels.retentionUnsupported')} small />
          )}
          {avgWatch >= 0 ? (
            <Text variant="small" color="secondary">
              {t('media.avgWatchTime')}: {formatDuration(avgWatch)}
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  preview: { width: 110, aspectRatio: 9 / 16, backgroundColor: '#111' },
  play: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  views: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center' },
  viewsText: { color: '#fff', fontWeight: '600', marginLeft: 3 },
  body: { flex: 1, padding: spacing.md, justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  cell: { width: '33.33%', paddingVertical: 3 },
  footer: { marginTop: spacing.sm, gap: spacing.xs },
});
