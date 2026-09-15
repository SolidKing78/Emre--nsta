import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';
import { Chip } from '@/components/common/Primitives';
import { Text } from '@/components/common/Text';
import { CarouselIcon, ReelBadgeIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { ContentPerformance } from '@/services/analytics/content';
import { formatCompact, formatPercent } from '@/utils/format';

interface ContentPerformanceCardProps {
  item: ContentPerformance;
  rank?: number;
  simulated?: boolean;
  /** Horizontal (tile) or full-width (row) layout. */
  layout?: 'tile' | 'row';
}

export function ContentPerformanceCard({ item, rank, simulated, layout = 'row' }: ContentPerformanceCardProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const router = useRouter();
  const indicators = useSimulationIndicators();
  const { media } = item;

  const stats: { label: string; value: string; show: boolean }[] = [
    { label: t('metric.views'), value: formatCompact(item.views, language), show: item.available.has('views') },
    { label: t('metric.reach'), value: formatCompact(item.reach, language), show: item.available.has('reach') },
    { label: t('metric.likes'), value: formatCompact(item.likes, language), show: true },
    { label: t('metric.comments'), value: formatCompact(item.comments, language), show: true },
    { label: t('metric.saves'), value: formatCompact(item.saves, language), show: item.available.has('saves') },
    { label: t('metric.shares'), value: formatCompact(item.shares, language), show: item.available.has('shares') },
  ].filter((s) => s.show);

  const badge = media.type === 'REEL' ? <ReelBadgeIcon size={14} /> : media.type === 'CAROUSEL_ALBUM' ? <CarouselIcon size={14} /> : null;

  if (layout === 'tile') {
    return (
      <PressableScale
        onPress={() => router.push(`/media/${media.id}`)}
        accessibilityRole="button"
        accessibilityLabel={media.caption.slice(0, 40)}
        style={[styles.tile, { borderColor: colors.borderStrong }]}
      >
        <View style={styles.tileImageWrap}>
          <Image source={{ uri: media.thumbnailUrl }} style={styles.tileImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          {badge ? <View style={styles.badge}>{badge}</View> : null}
        </View>
        <View style={styles.tileBody}>
          <Text variant="captionStrong" numberOfLines={1}>
            {formatCompact(item.views || item.likes, language)} {item.available.has('views') ? t('metric.views').toLowerCase() : t('metric.likes').toLowerCase()}
          </Text>
          <Text variant="small" color="secondary" numberOfLines={1}>
            {formatCompact(item.reach, language)} {t('metric.reach').toLowerCase()}
          </Text>
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={() => router.push(`/media/${media.id}`)}
      accessibilityRole="button"
      accessibilityLabel={media.caption.slice(0, 40)}
      scaleTo={0.985}
      style={[styles.row, { borderColor: simulated && indicators ? colors.simulation : colors.borderStrong, backgroundColor: colors.background }]}
    >
      <View style={styles.thumbWrap}>
        <Image source={{ uri: media.thumbnailUrl }} style={styles.thumb} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        {badge ? <View style={styles.badge}>{badge}</View> : null}
        {rank ? (
          <View style={[styles.rank, { backgroundColor: colors.text }]}>
            <Text variant="small" style={{ color: colors.background, fontWeight: '700' }}>
              {rank}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="captionStrong" numberOfLines={1} style={{ flex: 1 }}>
            {media.caption.split('\n')[0] || t(`type.${media.type}`)}
          </Text>
          {media.isSimulated && indicators ? <Chip label={t('sim.badge')} tone="simulation" small /> : null}
        </View>
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text variant="captionStrong">{s.value}</Text>
              <Text variant="small" color="tertiary" numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <Text variant="small" color="secondary">
            {t('metric.engagementRate')}:{' '}
            <Text variant="small" weight="700" color={simulated && indicators ? 'simulation' : 'primary'}>
              {item.engagementRate === null ? '—' : formatPercent(item.engagementRate, language, 2).replace('+', '')}
            </Text>
          </Text>
          <Text variant="small" color="tertiary">
            {t(`type.${media.type}`)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  thumbWrap: { width: 84, height: 112, borderRadius: radius.sm, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 6, right: 6 },
  rank: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  stat: { width: '33.33%', paddingVertical: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  tile: { width: 120, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: 'hidden' },
  tileImageWrap: { width: '100%', aspectRatio: 3 / 4 },
  tileImage: { width: '100%', height: '100%' },
  tileBody: { padding: spacing.sm },
});
