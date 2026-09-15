import { Image } from 'expo-image';
import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { GridSkeleton } from '@/components/common/Skeleton';
import { Text } from '@/components/common/Text';
import { CarouselIcon, EyeIcon, FlaskIcon, PinIcon, PlayIcon, ReelBadgeIcon } from '@/components/icons';
import { useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/i18n';
import type { AppMedia } from '@/types/app';
import { formatCompact } from '@/utils/format';

const GAP = 1.5;
const COLUMNS = 3;
const ASPECT = 3 / 4;
const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

interface MediaThumbnailProps {
  media: AppMedia;
  size: number;
  onPress: (media: AppMedia) => void;
  showViews?: boolean;
  /** View count shown bottom-left (Instagram shows it on your own professional grid). */
  views?: number;
}

export const MediaThumbnail = memo(function MediaThumbnail({ media, size, onPress, showViews, views }: MediaThumbnailProps) {
  const { colors } = useTheme();
  const language = useLanguage();
  const indicators = useSimulationIndicators();
  const badge =
    media.type === 'REEL' ? (
      <ReelBadgeIcon size={16} />
    ) : media.type === 'CAROUSEL_ALBUM' ? (
      <CarouselIcon size={16} />
    ) : media.type === 'VIDEO' ? (
      <PlayIcon size={16} />
    ) : null;
  return (
    <Pressable
      onPress={() => onPress(media)}
      accessibilityRole="imagebutton"
      accessibilityLabel={media.caption.slice(0, 40) || media.type}
      style={({ pressed }) => [{ width: size, height: size / ASPECT, backgroundColor: colors.skeleton, opacity: pressed ? 0.85 : 1 }]}
    >
      <Image
        source={{ uri: media.thumbnailUrl || media.mediaUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
        placeholder={{ blurhash: BLURHASH }}
        cachePolicy="memory-disk"
        recyclingKey={media.id}
        accessibilityIgnoresInvertColors
      />
      {badge ? <View style={styles.badge}>{badge}</View> : null}
      {media.isPinned ? (
        <View style={styles.pin}>
          <PinIcon size={14} />
        </View>
      ) : null}
      {media.isSimulated && indicators ? (
        <View style={[styles.sim, { backgroundColor: colors.simulation }]}>
          <FlaskIcon size={10} color="#fff" strokeWidth={2.4} />
        </View>
      ) : null}
      {views !== undefined || (showViews && media.type === 'REEL' && media.viewCount !== undefined) ? (
        <View style={styles.views}>
          {media.type === 'REEL' || media.type === 'VIDEO' ? <PlayIcon size={12} /> : <EyeIcon size={14} />}
          <Text variant="small" style={styles.viewsText}>
            {formatCompact(views ?? media.viewCount ?? 0, language)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

interface MediaGridProps {
  media: readonly AppMedia[];
  onPress: (media: AppMedia) => void;
  loading?: boolean;
  showViews?: boolean;
}

/** 3-column Instagram grid. Rendered as rows so it can live inside a parent FlatList. */
export function MediaGrid({ media, onPress, loading, showViews }: MediaGridProps) {
  const { width } = useWindowDimensions();
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  const rows: AppMedia[][] = [];
  for (let i = 0; i < media.length; i += COLUMNS) rows.push(media.slice(i, i + COLUMNS));
  if (loading && media.length === 0) return <GridSkeleton columns={COLUMNS} rows={4} gap={GAP} />;
  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={row.map((m) => m.id).join('-') || rowIndex} style={[styles.row, { marginBottom: GAP }]}>
          {row.map((item, i) => (
            <View key={item.id} style={{ marginRight: i < COLUMNS - 1 ? GAP : 0 }}>
              <MediaThumbnail media={item} size={size} onPress={onPress} showViews={showViews} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function useGridRowRenderer(onPress: (media: AppMedia) => void, showViews?: boolean, viewsById?: Record<string, number>) {
  const { width } = useWindowDimensions();
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  return useCallback(
    (row: AppMedia[]) => (
      <View style={[styles.row, { marginBottom: GAP }]}>
        {row.map((item, i) => (
          <View key={item.id} style={{ marginRight: i < COLUMNS - 1 ? GAP : 0 }}>
            <MediaThumbnail media={item} size={size} onPress={onPress} showViews={showViews} views={viewsById?.[item.id]} />
          </View>
        ))}
      </View>
    ),
    [size, onPress, showViews, viewsById],
  );
}

export function chunkRows(media: readonly AppMedia[]): AppMedia[][] {
  const rows: AppMedia[][] = [];
  for (let i = 0; i < media.length; i += COLUMNS) rows.push(media.slice(i, i + COLUMNS));
  return rows;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  badge: { position: 'absolute', top: 6, right: 6 },
  pin: { position: 'absolute', top: 6, left: 6 },
  sim: { position: 'absolute', bottom: 6, left: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  views: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center' },
  viewsText: { color: '#fff', fontWeight: '600', marginLeft: 3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
});
